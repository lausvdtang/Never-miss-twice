import { CARDIO_GUIDANCE } from '../data/presets';
import { hoursSince } from './date';
import type {
  CardioSession,
  SetLog,
  TemplateExercise,
  WorkoutSession,
} from './types';

/** Kleinste praktische sprong in de sportschool: 2,5 kg (twee 1,25-schijven). */
export const WEIGHT_STEP = 2.5;

export interface OverloadSuggestion {
  weightKg: number;
  reps: number;
  /** Korte uitleg naast het invoerveld, bijv. "vorige keer 60 kg × 8". */
  previous: string | null;
  /** Waarom dit voorstel? Eén korte zin, nooit dwingend. */
  reason: string;
  isIncrease: boolean;
}

/** Alle sets van een oefening uit de meest recente sessie waarin hij voorkwam. */
export function lastSetsFor(
  exerciseName: string,
  sessions: WorkoutSession[],
  excludeSessionId?: string,
): SetLog[] {
  const done = sessions
    .filter((s) => s.id !== excludeSessionId)
    .filter((s) => s.status === 'voltooid' || s.status === 'minimaal')
    .sort((a, b) => b.day.localeCompare(a.day));

  for (const session of done) {
    const sets = session.sets.filter(
      (s) => s.exerciseName === exerciseName && s.done,
    );
    if (sets.length > 0) return sets.sort((a, b) => a.setIndex - b.setIndex);
  }
  return [];
}

/**
 * Progressive overload: haalde je vorige keer op elke set de bovenkant van het
 * repbereik, dan stellen we een kleine gewichtsverhoging voor. Zo niet, dan
 * hetzelfde gewicht met één rep erbij als richtpunt.
 */
export function suggestNext(
  exercise: TemplateExercise,
  previousSets: SetLog[],
): OverloadSuggestion {
  if (previousSets.length === 0) {
    return {
      weightKg: 0,
      reps: exercise.repLow,
      previous: null,
      reason: 'Eerste keer — kies een gewicht waarbij je nog 2 reps over hebt.',
      isIncrease: false,
    };
  }

  const topWeight = Math.max(...previousSets.map((s) => s.weightKg));
  const setsAtTopWeight = previousSets.filter((s) => s.weightKg === topWeight);
  const minReps = Math.min(...setsAtTopWeight.map((s) => s.reps));
  const bestReps = Math.max(...setsAtTopWeight.map((s) => s.reps));
  const previous = `Vorige keer ${formatWeight(topWeight)} × ${bestReps}`;

  const clearedTop =
    minReps >= exercise.repHigh && setsAtTopWeight.length >= exercise.sets;

  if (clearedTop) {
    return {
      weightKg: topWeight + WEIGHT_STEP,
      reps: exercise.repLow,
      previous,
      reason: `Je haalde overal ${exercise.repHigh} reps — ${WEIGHT_STEP} kg erbij.`,
      isIncrease: true,
    };
  }

  return {
    weightKg: topWeight,
    reps: Math.min(bestReps + 1, exercise.repHigh),
    previous,
    reason: 'Zelfde gewicht, mik op één rep meer dan vorige keer.',
    isIncrease: false,
  };
}

export function formatWeight(kg: number): string {
  if (kg === 0) return 'lichaamsgewicht';
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(1).replace('.', ',')} kg`;
}

/** Totaal getild volume (kg × reps) — puur informatief op het overzicht. */
export function sessionVolume(session: WorkoutSession): number {
  return session.sets
    .filter((s) => s.done)
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export function sessionDurationMinutes(session: WorkoutSession): number | null {
  if (!session.startedAt || !session.finishedAt) return null;
  return Math.round(
    (new Date(session.finishedAt).getTime() -
      new Date(session.startedAt).getTime()) /
      60000,
  );
}

/**
 * Interference effect (§8.2): hardlopen vlak vóór krachttraining kost kracht.
 * We waarschuwen alleen zacht en alleen als het relevant is.
 */
export function cardioInterferenceWarning(
  plannedStrengthToday: boolean,
  strengthDoneToday: boolean,
): string | null {
  if (!plannedStrengthToday || strengthDoneToday) return null;
  return CARDIO_GUIDANCE.interferenceWarning;
}

/** §8.4: zachte hint als alcohol kort na een sessie wordt gelogd. */
export function hoursSinceLastSession(
  sessions: WorkoutSession[],
  now: Date = new Date(),
): number | null {
  const finished = sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1));
  if (finished.length === 0) return null;
  return hoursSince(finished[0].finishedAt!, now);
}

export function weeklyCardioMinutes(cardio: CardioSession[]): number {
  return cardio.reduce((sum, c) => sum + c.minutes, 0);
}

export function runsThisWeek(cardio: CardioSession[]): number {
  return cardio.filter((c) => c.kind === 'hardlopen' || c.kind === 'zone2').length;
}

/** Vult een sessie met lege sets op basis van het template. */
export function seedSets(
  exercises: TemplateExercise[],
  sessions: WorkoutSession[],
  now: string,
): SetLog[] {
  const sets: SetLog[] = [];
  for (const exercise of exercises) {
    const suggestion = suggestNext(exercise, lastSetsFor(exercise.name, sessions));
    for (let i = 0; i < exercise.sets; i++) {
      sets.push({
        id: `set_${exercise.id}_${i}_${now}`,
        exerciseName: exercise.name,
        setIndex: i,
        weightKg: suggestion.weightKg,
        reps: suggestion.reps,
        done: false,
        loggedAt: now,
      });
    }
  }
  return sets;
}
