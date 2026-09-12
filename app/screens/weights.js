import { el, when } from '../dom.js';
import { formatDayShort, nl } from '../date.js';
import { back, go } from '../nav.js';
import { splitForWeek, templatesForSplit } from '../selectors.js';
import { getState } from '../store.js';
import { currentWeights, exerciseSessions, loggedWeights, weightsSummary } from '../progress.js';
import { badge, button, card, cardTitle, closeSheet, empty, openSheet, sparkline } from '../ui.js';

function kgLabel(value) {
  return Number.isInteger(value) ? String(value) : nl(value);
}

/** Oefeningen uit het schema dat deze week actief is, in schemavolgorde. */
function scheduledExercises(state) {
  return templatesForSplit(state, splitForWeek(state)).flatMap((t) => t.exercises);
}

function deltaBadge(deltaKg) {
  if (deltaKg === null || deltaKg === 0) return null;
  const sign = deltaKg > 0 ? '+' : '−';
  // Omhoog is accent, omlaag blijft rustig: minder tillen is informatie, geen fout.
  return badge(`${sign}${kgLabel(Math.abs(deltaKg))}`, deltaKg > 0 ? 'accent' : 'calm');
}

function setsLine(sets) {
  return sets
    .map((s) => (s.weightKg === 0 ? `lg×${s.reps}` : `${kgLabel(s.weightKg)}×${s.reps}`))
    .join('  ·  ');
}

/**
 * Volledige geschiedenis van één oefening: wanneer, welke sets, en het verloop
 * erboven. Zo hoef je voor "wat deed ik in juli?" niet door losse sessies.
 */
function openHistorySheet(name) {
  openSheet({
    title: name,
    render() {
      const state = getState();
      const entries = exerciseSessions(state.sessions, name);
      const trend = [...entries].reverse().map((e) => e.topWeightKg);

      if (entries.length === 0) {
        return empty('Nog niets gelogd voor deze oefening.');
      }

      return el(
        'div',
        { class: 'stack' },
        when(trend.length >= 2, () =>
          card(
            'flat',
            el(
              'div',
              { class: 'row-between' },
              el('span', { class: 'eyebrow' }, 'Topgewicht per sessie'),
              el('span', { class: 'weights-spark' }, sparkline(trend)),
            ),
            el(
              'p',
              { class: 'faint' },
              `${kgLabel(trend[0])} → ${kgLabel(trend[trend.length - 1])} kg over ${
                trend.length
              } sessies.`,
            ),
          ),
        ),
        el(
          'div',
          { class: 'list' },
          ...entries.map((entry) =>
            el(
              'button',
              {
                class: 'list-item',
                onclick: () => {
                  closeSheet();
                  go('sessie', entry.id);
                },
              },
              el(
                'span',
                { class: 'grow' },
                el('span', { class: 'title' }, formatDayShort(entry.day)),
                el('span', { class: 'faint' }, entry.templateName),
              ),
              el('span', { class: 'prev-sets' }, setsLine(entry.sets)),
            ),
          ),
        ),
      );
    },
  });
}

function weightRow(row) {
  const meta = [
    row.setCount > 0 ? `${row.setCount}×${row.reps}` : null,
    row.day ? formatDayShort(row.day) : null,
    row.scheduled ? null : 'niet in je schema',
  ]
    .filter(Boolean)
    .join(' · ');

  return el(
    'button',
    {
      class: 'weights-row',
      onclick: () => openHistorySheet(row.name),
      'aria-label': `${row.name}, geschiedenis bekijken`,
    },
    el(
      'span',
      { class: 'grow' },
      el('span', { class: 'title' }, row.name),
      el('span', { class: 'faint' }, meta),
    ),
    // Een lijn door allemaal nullen zegt niets; lichaamsgewicht heeft geen verloop in kg.
    when(row.series.length >= 2 && row.series.some((v) => v > 0), () =>
      el('span', { class: 'weights-spark sm' }, sparkline(row.series)),
    ),
    el(
      'span',
      { class: 'weights-value' },
      row.weightKg === 0
        ? el('span', { class: 'weights-kg bw' }, 'eigen gewicht')
        : el('span', { class: 'weights-kg' }, `${kgLabel(row.weightKg)} kg`),
      deltaBadge(row.deltaKg),
    ),
  );
}

/**
 * Actueel gewicht per oefening.
 *
 * Één scherm dat de vraag "wat til ik hier ook alweer?" beantwoordt zonder dat
 * je sessies hoeft terug te zoeken. Zwaarste werkgewicht van de laatste keer,
 * want dat is het getal waarmee je de volgende keer begint.
 */
export function renderWeights() {
  const state = getState();
  const rows = currentWeights(state.sessions, scheduledExercises(state));
  const logged = loggedWeights(rows);
  const todo = rows.filter((r) => r.day === null);

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow' }, 'Training'),
        el('h1', {}, 'Gewichten'),
      ),
      button('✕', { variant: 'icon ghost', ariaLabel: 'Terug', onclick: back }),
    ),

    el('p', { class: 'muted' }, weightsSummary(rows)),

    when(logged.length > 0, () =>
      card(
        null,
        cardTitle(
          el('p', { class: 'eyebrow' }, 'Laatste werkgewicht'),
          badge('tik voor verloop', 'calm'),
        ),
        el('div', { class: 'weights-list' }, ...logged.map(weightRow)),
      ),
    ),

    when(logged.length === 0, () =>
      card(
        'flat',
        el(
          'p',
          { class: 'muted' },
          'Zodra je in een sessie een gewicht invult, verschijnt het hier — en staat het de volgende keer automatisch klaar.',
        ),
      ),
    ),

    when(todo.length > 0, () =>
      card(
        null,
        cardTitle(
          el('p', { class: 'eyebrow' }, 'Nog niet gelogd'),
          badge(String(todo.length), 'calm'),
        ),
        el(
          'p',
          { class: 'muted' },
          'Deze staan wel in je schema. De eerste keer kies je zelf een gewicht waarbij je nog 2 reps over hebt.',
        ),
        el(
          'div',
          { class: 'row wrap' },
          ...todo.map((row) =>
            el(
              'span',
              {
                class: 'chip outline',
                title: [row.plannedSets ? `${row.plannedSets}×${row.repRange}` : null, row.note]
                  .filter(Boolean)
                  .join(' · '),
              },
              row.name,
            ),
          ),
        ),
      ),
    ),
  );
}
