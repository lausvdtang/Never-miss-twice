import { CARDIO_GUIDANCE } from './presets.js';
import { hoursSince, nl } from './date.js';

/** Kleinste praktische sprong in de sportschool: 2,5 kg (twee 1,25-schijven). */
export const WEIGHT_STEP = 2.5;

/**
 * De laatste keer dat je deze oefening deed: welke dag, en met welke sets.
 *
 * Een set telt mee als hij is afgevinkt óf als je er zelf een gewicht in hebt
 * gezet. Dat tweede is belangrijk: je mag een sessie afronden zonder alles af
 * te vinken, en dan zou je volgende keer weer op nul beginnen en moeten
 * opzoeken wat je vorige keer tilde.
 *
 * Wat de app zelf heeft voorgesteld (`seeded`) telt níét mee zolang je het
 * niet hebt aangeraakt — anders zou een voorstel dat je nooit hebt getild de
 * geschiedenis worden, en zou het gewicht vanzelf gaan oplopen.
 */
export function lastPerformanceFor(exerciseName, sessions, excludeSessionId) {
  const candidates = sessions
    .filter((s) => s.id !== excludeSessionId && s.status !== 'gemist')
    .sort((a, b) => b.day.localeCompare(a.day));

  for (const session of candidates) {
    const mine = session.sets.filter((s) => s.exerciseName === exerciseName);
    if (mine.length === 0) continue;

    const usable = mine.filter((s) => s.done || (!s.seeded && s.weightKg > 0));
    if (usable.length === 0) continue;

    return {
      day: session.day,
      sets: [...usable].sort((a, b) => a.setIndex - b.setIndex),
      confirmed: usable.some((s) => s.done),
    };
  }
  return null;
}

/** Alleen de sets van die laatste keer. */
export function lastSetsFor(exerciseName, sessions, excludeSessionId) {
  return lastPerformanceFor(exerciseName, sessions, excludeSessionId)?.sets ?? [];
}

/**
 * Progressive overload: haalde je vorige keer op elke set de bovenkant van het
 * repbereik, dan stellen we een kleine gewichtsverhoging voor. Zo niet, dan
 * hetzelfde gewicht met één rep erbij als richtpunt.
 */
export function suggestNext(exercise, previousSets) {
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

export function formatWeight(kg) {
  if (kg === 0) return 'lichaamsgewicht';
  return Number.isInteger(kg) ? `${kg} kg` : `${nl(kg)} kg`;
}

/** Totaal getild volume (kg × reps) — puur informatief op het overzicht. */
export function sessionVolume(session) {
  return session.sets
    .filter((s) => s.done)
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export function sessionDurationMinutes(session) {
  if (!session.startedAt || !session.finishedAt) return null;
  return Math.round(
    (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) /
      60000,
  );
}

/**
 * Interference effect (§8.2): hardlopen vlak vóór krachttraining kost kracht.
 * We waarschuwen alleen zacht en alleen als het relevant is.
 */
export function cardioInterferenceWarning(plannedStrengthToday, strengthDoneToday) {
  if (!plannedStrengthToday || strengthDoneToday) return null;
  return CARDIO_GUIDANCE.interferenceWarning;
}

/** §8.4: zachte hint als alcohol kort na een sessie wordt gelogd. */
export function hoursSinceLastSession(sessions, now = new Date()) {
  const finished = sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
  if (finished.length === 0) return null;
  return hoursSince(finished[0].finishedAt, now);
}

export function weeklyCardioMinutes(cardio) {
  return cardio.reduce((sum, c) => sum + c.minutes, 0);
}

export function runsThisWeek(cardio) {
  return cardio.filter((c) => c.kind === 'hardlopen' || c.kind === 'zone2').length;
}

/** Vult een sessie met lege sets op basis van het template. */
export function seedSets(exercises, sessions, now) {
  const sets = [];
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
        // Voorgesteld door de app. Zodra je het aanpast of afvinkt vervalt
        // deze vlag en telt de set mee als geschiedenis.
        seeded: true,
        loggedAt: now,
      });
    }
  }
  return sets;
}
