import { formatDayShort } from './date.js';
import { loggedSets, sessionCounts, sessionVolume } from './training.js';

/**
 * Voortgang per training en per oefening.
 *
 * "Doe ik steeds meer?" is een vraag over volume (gewicht × reps), niet over
 * één set. Daarom vergelijken we sessies van hetzelfde schema met elkaar —
 * een Push A vergelijken met een Legs B zegt niets.
 */

/** Afgeronde sessies van één schema, oudste eerst. */
export function sessionsForTemplate(sessions, templateName, { limit = 10 } = {}) {
  return sessions
    .filter(
      (s) =>
        s.templateName === templateName &&
        sessionCounts(s) &&
        // Alleen sessies met echt getild gewicht: anders staan er lege staven
        // in de grafiek.
        s.sets.some((x) => x.weightKg > 0),
    )
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-limit);
}

/** Volume per sessie, klaar voor de staafgrafiek. */
export function volumeSeries(sessions, templateName, options) {
  return sessionsForTemplate(sessions, templateName, options).map((s) => ({
    day: s.day,
    label: formatDayShort(s.day).split(' ')[1] ?? formatDayShort(s.day),
    value: Math.round(sessionVolume(s)),
    sessionId: s.id,
  }));
}

/**
 * Het zwaarste werkgewicht per sessie voor één oefening.
 * Gebruikt voor de sparkline naast de oefening.
 */
export function topWeightSeries(sessions, exerciseName, { limit = 8 } = {}) {
  const series = [];
  const sorted = [...sessions].filter(sessionCounts).sort((a, b) => a.day.localeCompare(b.day));

  for (const session of sorted) {
    // Zelfde maatstaf als de rest: afgevinkt óf zelf ingevuld telt.
    const sets = loggedSets(session).filter((s) => s.exerciseName === exerciseName);
    if (sets.length === 0) continue;
    series.push({
      day: session.day,
      weightKg: Math.max(...sets.map((s) => s.weightKg)),
      reps: Math.max(...sets.map((s) => s.reps)),
      volume: sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
    });
  }

  return series.slice(-limit);
}

/**
 * Verschil tussen de laatste twee sessies van een schema, in procenten.
 * Levert `null` zolang er niets te vergelijken valt.
 */
export function volumeChange(series) {
  if (series.length < 2) return null;
  const previous = series[series.length - 2].value;
  const current = series[series.length - 1].value;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Label voor naast de grafiektitel.
 *
 * De staven lopen vanaf nul — dat hoort zo, anders lijkt een paar procent
 * verschil ineens een verdubbeling. Maar daardoor zie je een stijging van 8%
 * nauwelijks. Dit getal geeft dus het antwoord op "doe ik steeds meer?" dat je
 * uit de staafhoogtes alleen niet afleest.
 */
export function changeLabel(series) {
  const change = volumeChange(series);
  if (change === null) return { text: 'volume', tone: 'calm' };
  if (change > 0) return { text: `+${change}%`, tone: 'accent' };
  if (change < 0) return { text: `${change}%`, tone: 'calm' };
  return { text: 'gelijk', tone: 'calm' };
}

/**
 * Korte samenvatting onder de grafiek. Bewust feitelijk en zonder oordeel:
 * een mindere week is informatie, geen fout.
 */
export function progressSummary(series) {
  if (series.length === 0) return 'Nog geen afgeronde sessies van deze training.';
  if (series.length === 1) {
    return `Eerste sessie gelogd: ${series[0].value.toLocaleString('nl-NL')} kg totaal volume.`;
  }

  const change = volumeChange(series);
  const best = Math.max(...series.map((s) => s.value));
  const current = series[series.length - 1].value;

  /*
   * Volume telt alleen het gewicht dat je op de stang legt. Een sessie met
   * puur lichaamsgewicht (pull-ups, dips, plank) komt dus op 0 uit, en dan is
   * "100% minder" onzin in plaats van informatie.
   */
  if (current === 0) {
    return 'Deze sessie stond er geen gewicht bij ingevuld. Volume telt alleen wat je extra tilt — lichaamsgewicht valt erbuiten.';
  }

  if (current >= best) {
    return `Hoogste volume tot nu toe: ${current.toLocaleString('nl-NL')} kg.`;
  }
  if (change === null) return `${current.toLocaleString('nl-NL')} kg deze sessie.`;
  if (change >= 0) {
    return `${change}% meer volume dan de vorige keer. Beste tot nu toe: ${best.toLocaleString('nl-NL')} kg.`;
  }
  return `${Math.abs(change)}% minder dan de vorige keer — dat hoort erbij. Beste tot nu toe: ${best.toLocaleString('nl-NL')} kg.`;
}
