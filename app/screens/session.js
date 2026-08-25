import { clear, el, when } from '../dom.js';
import { MINIMAL_VERSION_TEXT, exerciseLibrary } from '../presets.js';
import { formatDayShort, nl } from '../date.js';
import { back, go } from '../nav.js';
import { changeLabel, progressSummary, topWeightSeries, volumeSeries } from '../progress.js';
import { getState, newId, nowISO, update } from '../store.js';
import {
  formatWeight,
  lastSetsFor,
  sessionDurationMinutes,
  sessionVolume,
  suggestNext,
  WEIGHT_STEP,
} from '../training.js';
import {
  badge,
  bar,
  barChart,
  button,
  card,
  cardTitle,
  closeSheet,
  miniStepper,
  openSheet,
  sparkline,
  tapFeedback,
  toast,
} from '../ui.js';

/**
 * Actieve sessie. Elke set is één tap om af te vinken; gewicht en reps staan al
 * ingevuld met het voorstel op basis van de vorige keer.
 */
export function renderSession(sessionId) {
  const state = getState();
  const session = state.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return el(
      'div',
      { class: 'screen' },
      el('p', { class: 'empty' }, 'Deze sessie bestaat niet meer.'),
      button('Terug naar training', {
        variant: 'ghost block',
        onclick: () => go('training'),
      }),
    );
  }

  const template = session.templateId
    ? state.templates.find((t) => t.id === session.templateId)
    : undefined;

  // Sets groeperen per oefening, met behoud van de volgorde uit het schema.
  const order = [];
  const byExercise = new Map();
  for (const set of session.sets) {
    if (!byExercise.has(set.exerciseName)) {
      byExercise.set(set.exerciseName, []);
      order.push(set.exerciseName);
    }
    byExercise.get(set.exerciseName).push(set);
  }
  const grouped = order.map((name) => ({ name, sets: byExercise.get(name) }));

  const readOnly = session.status === 'voltooid' || session.status === 'minimaal';
  const doneSets = session.sets.filter((s) => s.done).length;
  const totalSets = session.sets.length;

  function patchSet(setId, patch) {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? { ...x, sets: x.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }
          : x,
      );
    });
  }

  function toggleSet(set) {
    patchSet(set.id, { done: !set.done, loggedAt: nowISO() });
    if (!set.done) tapFeedback(state.settings.celebrate);
  }

  /** Alle sets van een oefening in één keer — scheelt taps bij een vaste opbouw. */
  function completeExercise(name) {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? {
              ...x,
              sets: x.sets.map((set) =>
                set.exerciseName === name ? { ...set, done: true, loggedAt: nowISO() } : set,
              ),
            }
          : x,
      );
    });
    tapFeedback(state.settings.celebrate);
    toast(`${name} afgerond`, true);
  }

  /* ------------------------------------------- oefeningen aanpassen */

  /** Vervangt alle sets van een oefening door die van een andere oefening. */
  function replaceExercise(oldName, replacement) {
    update((s) => {
      s.sessions = s.sessions.map((x) => {
        if (x.id !== sessionId) return x;
        const kept = x.sets.filter((set) => set.exerciseName !== oldName);
        const count = x.sets.filter((set) => set.exerciseName === oldName).length;
        const now = nowISO();
        const fresh = Array.from({ length: count || replacement.sets }, (_, i) => ({
          id: newId('set'),
          exerciseName: replacement.name,
          setIndex: i,
          weightKg: 0,
          reps: parseInt(replacement.repRange, 10) || 8,
          done: false,
          loggedAt: now,
        }));
        // Op de plek van de oude oefening invoegen, niet onderaan plakken.
        const at = x.sets.findIndex((set) => set.exerciseName === oldName);
        const before = kept.filter((_, i) => i < at);
        const after = kept.filter((_, i) => i >= at);
        return { ...x, sets: [...before, ...fresh, ...after] };
      });
    });
    closeSheet();
    toast(`${oldName} vervangen door ${replacement.name}`, true);
  }

  function addExercise(exercise) {
    update((s) => {
      s.sessions = s.sessions.map((x) => {
        if (x.id !== sessionId) return x;
        const now = nowISO();
        const fresh = Array.from({ length: exercise.sets }, (_, i) => ({
          id: newId('set'),
          exerciseName: exercise.name,
          setIndex: i,
          weightKg: 0,
          reps: parseInt(exercise.repRange, 10) || 8,
          done: false,
          loggedAt: now,
        }));
        return { ...x, sets: [...x.sets, ...fresh] };
      });
    });
    closeSheet();
    toast(`${exercise.name} toegevoegd`, true);
  }

  function removeExercise(name) {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? { ...x, sets: x.sets.filter((set) => set.exerciseName !== name) }
          : x,
      );
    });
    closeSheet();
    toast(`${name} van deze sessie gehaald`);
  }

  function addSet(name) {
    update((s) => {
      s.sessions = s.sessions.map((x) => {
        if (x.id !== sessionId) return x;
        const own = x.sets.filter((set) => set.exerciseName === name);
        const last = own[own.length - 1];
        const at = x.sets.lastIndexOf(last);
        const fresh = {
          id: newId('set'),
          exerciseName: name,
          setIndex: own.length,
          weightKg: last?.weightKg ?? 0,
          reps: last?.reps ?? 8,
          done: false,
          loggedAt: nowISO(),
        };
        return { ...x, sets: [...x.sets.slice(0, at + 1), fresh, ...x.sets.slice(at + 1)] };
      });
    });
    tapFeedback(state.settings.celebrate);
  }

  /** Kiezerslijst met zoekveld, gedeeld door vervangen en toevoegen. */
  function openExercisePicker({ title, exclude = [], onPick }) {
    let query = '';
    const library = exerciseLibrary();

    openSheet({
      title,
      render() {
        const listEl = el('div', { class: 'list' });

        const fill = () => {
          clear(listEl);
          const q = query.trim().toLowerCase();
          const results = library
            .filter((e) => !exclude.includes(e.name))
            .filter((e) => !q || e.name.toLowerCase().includes(q))
            .slice(0, 40);

          if (results.length === 0) {
            listEl.appendChild(
              el(
                'button',
                {
                  class: 'list-item',
                  onclick: () =>
                    onPick({ name: query.trim(), sets: 3, repRange: '10' }),
                },
                el(
                  'span',
                  { class: 'grow' },
                  el('span', { class: 'title' }, `"${query.trim()}" gebruiken`),
                  el('span', { class: 'faint' }, 'Eigen oefening, 3 sets'),
                ),
              ),
            );
            return;
          }

          for (const e of results) {
            listEl.appendChild(
              el(
                'button',
                { class: 'list-item', onclick: () => onPick(e) },
                el(
                  'span',
                  { class: 'grow' },
                  el('span', { class: 'title' }, e.name),
                  el('span', { class: 'faint' }, `${e.sets}×${e.repRange}`),
                ),
              ),
            );
          }
        };
        fill();

        return el(
          'div',
          { class: 'stack' },
          el('input', {
            class: 'input',
            placeholder: 'Zoeken of zelf typen…',
            'aria-label': 'Zoek een oefening',
            oninput: (e) => {
              query = e.target.value;
              fill();
            },
          }),
          listEl,
        );
      },
    });
  }

  function openExerciseMenu(name) {
    openSheet({
      title: name,
      render: () =>
        el(
          'div',
          { class: 'stack' },
          button('Vervang door een andere oefening', {
            variant: 'lg block',
            onclick: () =>
              openExercisePicker({
                title: `${name} vervangen`,
                exclude: [name],
                onPick: (e) => replaceExercise(name, e),
              }),
          }),
          button('Set toevoegen', {
            variant: 'lg block',
            onclick: () => {
              addSet(name);
              closeSheet();
            },
          }),
          button('Van deze sessie halen', {
            variant: 'quiet block',
            onclick: () => removeExercise(name),
          }),
        ),
    });
  }

  function finish(status) {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? {
              ...x,
              status,
              finishedAt: nowISO(),
              ...(status === 'minimaal' ? { minimalNote: MINIMAL_VERSION_TEXT } : {}),
            }
          : x,
      );
    });
    closeSheet();
    tapFeedback(state.settings.celebrate);
    toast('Ik ben iemand die traint. Weer een dag waarop dat klopt.', true);
    go('vandaag');
  }

  function openFinishSheet() {
    openSheet({
      title: 'Afronden',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          el(
            'p',
            { class: 'muted' },
            doneSets < totalSets
              ? `Je hebt ${doneSets} van de ${totalSets} sets gelogd. Dat is genoeg — een afgeronde sessie hoeft niet compleet te zijn.`
              : 'Alle sets gelogd. Mooi werk.',
          ),
          button('Afronden', {
            variant: 'primary lg block',
            onclick: () => finish('voltooid'),
          }),
          button('Toch nog even door', { variant: 'quiet block', onclick: closeSheet }),
        ),
    });
  }

  const duration = sessionDurationMinutes(session);
  const minimalOnly = session.status === 'minimaal' && session.sets.length === 0;

  // Volume van eerdere sessies van ditzelfde schema, huidige sessie erbij.
  const history = volumeSeries(state.sessions, session.templateName);
  if (!readOnly && sessionVolume(session) > 0) {
    history.push({
      day: session.day,
      label: 'nu',
      value: Math.round(sessionVolume(session)),
      sessionId: session.id,
      highlight: true,
    });
  } else if (history.length > 0) {
    const last = history[history.length - 1];
    if (last.sessionId === session.id) last.highlight = true;
  }

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el(
          'p',
          { class: 'eyebrow' },
          `${formatDayShort(session.day)}${readOnly ? ' · afgerond' : ''}`,
        ),
        el('h1', {}, session.templateName),
      ),
      button('✕', { variant: 'icon ghost', ariaLabel: 'Terug', onclick: back }),
    ),

    ...(minimalOnly
      ? [
          card(
            'accent',
            el('h3', {}, 'Minimale versie'),
            el('p', { class: 'muted' }, session.minimalNote ?? MINIMAL_VERSION_TEXT),
            el(
              'p',
              { class: 'faint' },
              'Deze dag telt volledig mee. Eén dag klein doen is precies waar dit systeem voor bedoeld is.',
            ),
          ),
        ]
      : [
          when(!readOnly, () =>
            card(
              'flat',
              el(
                'div',
                { class: 'row-between' },
                el('span', { class: 'muted' }, `${doneSets} van ${totalSets} sets`),
                badge(
                  `${Math.round(sessionVolume(session)).toLocaleString('nl-NL')} kg`,
                  'accent',
                ),
              ),
              bar({ value: doneSets, max: totalSets }),
            ),
          ),

          /* Doe ik steeds meer? Volume per sessie van ditzelfde schema. */
          when(history.length > 0, () =>
            card(
              null,
              cardTitle(
                el('p', { class: 'eyebrow' }, `Voortgang ${session.templateName}`),
                (() => {
                  const label = changeLabel(history);
                  return badge(label.text, label.tone);
                })(),
              ),
              barChart(history, {
                formatValue: (v) => `${v.toLocaleString('nl-NL')} kg`,
              }),
              el('p', { class: 'muted' }, progressSummary(history)),
            ),
          ),

          ...grouped.map(({ name, sets }) => {
            const exercise = template?.exercises.find((e) => e.name === name);
            const previous = lastSetsFor(name, state.sessions, sessionId);
            const suggestion = exercise ? suggestNext(exercise, previous) : null;
            const allDone = sets.every((s) => s.done);
            const trendPoints = topWeightSeries(state.sessions, name).filter(
              (p) => p.day !== session.day,
            );

            return card(
              null,
              cardTitle(
                el(
                  'div',
                  { class: 'grow' },
                  el('h3', {}, name),
                  el(
                    'p',
                    { class: 'faint' },
                    `${exercise ? `${exercise.sets}×${exercise.repRange}` : `${sets.length} sets`}${
                      exercise?.note ? ` · ${exercise.note}` : ''
                    }`,
                  ),
                ),
                when(allDone, () => badge('✓', 'accent')),
                when(!readOnly, () =>
                  button('⋯', {
                    variant: 'quiet sm',
                    ariaLabel: `${name} aanpassen`,
                    onclick: () => openExerciseMenu(name),
                  }),
                ),
              ),

              /* Verloop van het zwaarste werkgewicht over eerdere sessies. */
              when(trendPoints.length >= 2, () =>
                el(
                  'div',
                  { class: 'row-between' },
                  sparkline(trendPoints.map((p) => p.weightKg)),
                  el(
                    'span',
                    { class: 'faint' },
                    `${nl(trendPoints[0].weightKg)} → ${nl(
                      trendPoints[trendPoints.length - 1].weightKg,
                    )} kg`,
                  ),
                ),
              ),

              /* Progressive overload: vorige sessie naast het invoerveld. */
              when(!!suggestion && !readOnly, () =>
                el(
                  'div',
                  { class: 'row-between' },
                  el('span', { class: 'faint' }, suggestion.previous ?? 'Nog geen eerdere sessie'),
                  when(suggestion.isIncrease, () => badge(`+${WEIGHT_STEP} kg`, 'accent')),
                ),
              ),
              when(!!suggestion && !readOnly, () =>
                el('p', { class: 'faint' }, suggestion.reason),
              ),

              el(
                'div',
                {},
                ...sets.map((set) =>
                  el(
                    'div',
                    { class: `set-row${set.done ? ' done' : ''}` },
                    el('span', { class: 'set-index' }, String(set.setIndex + 1)),
                    ...(readOnly
                      ? [
                          el('span', { class: 'faint' }, formatWeight(set.weightKg)),
                          el('span', { class: 'faint' }, `${set.reps} reps`),
                        ]
                      : [
                          miniStepper({
                            value: set.weightKg,
                            onChange: (v) => patchSet(set.id, { weightKg: v }),
                            step: WEIGHT_STEP,
                            unit: 'kg',
                            ariaLabel: `${name} set ${set.setIndex + 1} gewicht`,
                          }),
                          miniStepper({
                            value: set.reps,
                            onChange: (v) => patchSet(set.id, { reps: v }),
                            min: 1,
                            ariaLabel: `${name} set ${set.setIndex + 1} reps`,
                          }),
                        ]),
                    el(
                      'button',
                      {
                        class: `check${set.done ? ' on' : ''}`,
                        style: { marginLeft: 'auto' },
                        'aria-label': `Set ${set.setIndex + 1} afvinken`,
                        disabled: readOnly,
                        onclick: () => !readOnly && toggleSet(set),
                      },
                      set.done ? '✓' : '',
                    ),
                  ),
                ),
              ),

              when(!readOnly, () =>
                el(
                  'div',
                  { class: 'row' },
                  when(!allDone, () =>
                    button('Alles afvinken', {
                      variant: 'sm ghost',
                      onclick: () => completeExercise(name),
                    }),
                  ),
                  button('+ Set', {
                    variant: 'sm ghost',
                    ariaLabel: `Set toevoegen aan ${name}`,
                    onclick: () => addSet(name),
                  }),
                ),
              ),
            );
          }),

          when(!readOnly, () =>
            button('+ Oefening toevoegen', {
              variant: 'ghost block',
              onclick: () =>
                openExercisePicker({
                  title: 'Oefening toevoegen',
                  exclude: grouped.map((g) => g.name),
                  onPick: addExercise,
                }),
            }),
          ),
        ]),

    ...(readOnly
      ? [
          card(
            'flat',
            el(
              'div',
              { class: 'row-between' },
              el('span', { class: 'muted' }, duration ? `${duration} minuten` : 'Afgerond'),
              el(
                'span',
                { class: 'faint' },
                `${session.sets.filter((s) => s.done).length} sets gelogd`,
              ),
            ),
          ),
        ]
      : [
          button('Sessie afronden', {
            variant: 'primary xl block',
            sub: `${doneSets} van ${totalSets} sets gedaan`,
            onclick: openFinishSheet,
          }),
          button('Vandaag lukt het niet — noteer als minimale versie', {
            variant: 'quiet block',
            onclick: () => finish('minimaal'),
          }),
        ]),
  );
}
