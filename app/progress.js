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

/**
 * Het zwaarste werkgewicht per sessie, met de reps die daarbij horen.
 *
 * `topWeightSeries` geeft de hóógste reps van álle sets — handig voor een
 * lijn, maar misleidend in een overzicht: 3 reps op 100 kg en 12 op 60 kg zou
 * dan "100 kg × 12" worden. Hier tellen alleen de reps op het topgewicht.
 */
function topPerSession(sessions, exerciseName) {
  const out = [];
  const sorted = [...sessions].filter(sessionCounts).sort((a, b) => a.day.localeCompare(b.day));

  for (const session of sorted) {
    const sets = loggedSets(session).filter((s) => s.exerciseName === exerciseName);
    if (sets.length === 0) continue;

    const weightKg = Math.max(...sets.map((s) => s.weightKg));
    const atTop = sets.filter((s) => s.weightKg === weightKg);
    out.push({
      day: session.day,
      weightKg,
      reps: Math.max(...atTop.map((s) => s.reps)),
      setCount: atTop.length,
    });
  }
  return out;
}

/** Hoofdoefeningen bovenaan, daarna op alfabet — een vaste, voorspelbare volgorde. */
function byImportance(a, b) {
  if (a.isKeystone !== b.isKeystone) return a.isKeystone ? -1 : 1;
  return a.name.localeCompare(b.name, 'nl');
}

/**
 * Actueel werkgewicht per oefening.
 *
 * Eén regel per oefening, niet per schema: "Squat" staat in Lower A én in Full
 * Body, maar het is dezelfde oefening met hetzelfde gewicht. De app houdt de
 * geschiedenis ook op naam bij, dus dedupliceren op naam klopt met de rest.
 *
 * Oefeningen die je ooit gelogd hebt maar die niet meer in je schema staan
 * blijven zichtbaar (`scheduled: false`) — anders verdwijnt je gewicht zodra
 * je een split wisselt, precies wanneer je het wilt opzoeken.
 */
export function currentWeights(sessions, scheduledExercises = []) {
  const rows = new Map();

  for (const e of scheduledExercises) {
    const existing = rows.get(e.name);
    if (existing) {
      existing.isKeystone = existing.isKeystone || !!e.isKeystone;
      continue;
    }
    rows.set(e.name, {
      name: e.name,
      isKeystone: !!e.isKeystone,
      repRange: e.repRange ?? null,
      plannedSets: e.sets ?? null,
      note: e.note ?? null,
      scheduled: true,
    });
  }

  for (const session of sessions) {
    for (const set of session.sets) {
      if (rows.has(set.exerciseName)) continue;
      rows.set(set.exerciseName, {
        name: set.exerciseName,
        isKeystone: false,
        repRange: null,
        plannedSets: null,
        note: null,
        scheduled: false,
      });
    }
  }

  return [...rows.values()]
    .map((base) => {
      const history = topPerSession(sessions, base.name);
      const last = history[history.length - 1] ?? null;
      const previous = history.length >= 2 ? history[history.length - 2] : null;

      return {
        ...base,
        weightKg: last ? last.weightKg : null,
        reps: last ? last.reps : null,
        setCount: last ? last.setCount : 0,
        day: last ? last.day : null,
        // Afronden op 2 decimalen: 82.5 - 80 geeft in drijvende komma 2.4999…
        deltaKg:
          last && previous ? Math.round((last.weightKg - previous.weightKg) * 100) / 100 : null,
        sessionCount: history.length,
        series: history.slice(-8).map((h) => h.weightKg),
      };
    })
    .sort(byImportance);
}

/** Alleen de oefeningen waar al een gewicht van bekend is. */
export function loggedWeights(rows) {
  return rows.filter((r) => r.day !== null);
}

/**
 * Eén regel samenvatting boven het overzicht. Bewust zonder oordeel: minder
 * dan vorige keer is informatie, geen fout.
 */
export function weightsSummary(rows) {
  const logged = loggedWeights(rows);
  if (logged.length === 0) {
    return 'Nog geen gewichten gelogd. Zodra je een sessie invult, staat het hier.';
  }
  const up = logged.filter((r) => r.deltaKg !== null && r.deltaKg > 0).length;
  const base = `${logged.length} ${logged.length === 1 ? 'oefening' : 'oefeningen'} met een gewicht`;
  if (up === 0) return `${base}.`;
  return `${base}, waarvan ${up} zwaarder dan de vorige keer.`;
}

/**
 * De sessies waarin één oefening voorkomt, met alle sets — nieuwste eerst.
 * Voor het venster achter een regel in het gewichtenoverzicht.
 */
export function exerciseSessions(sessions, exerciseName, { limit = 12 } = {}) {
  return [...sessions]
    .filter(sessionCounts)
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((session) => ({
      session,
      sets: loggedSets(session)
        .filter((s) => s.exerciseName === exerciseName)
        .sort((a, b) => a.setIndex - b.setIndex),
    }))
    .filter((entry) => entry.sets.length > 0)
    .slice(0, limit)
    .map(({ session, sets }) => ({
      id: session.id,
      day: session.day,
      templateName: session.templateName,
      sets,
      topWeightKg: Math.max(...sets.map((s) => s.weightKg)),
    }));
}
