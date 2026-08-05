import { el, when } from '../dom.js';
import { MINIMAL_VERSION_TEXT } from '../presets.js';
import { formatDayShort } from '../date.js';
import { back, go } from '../nav.js';
import { getState, nowISO, update } from '../store.js';
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
  button,
  card,
  cardTitle,
  closeSheet,
  miniStepper,
  openSheet,
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

          ...grouped.map(({ name, sets }) => {
            const exercise = template?.exercises.find((e) => e.name === name);
            const previous = lastSetsFor(name, state.sessions, sessionId);
            const suggestion = exercise ? suggestNext(exercise, previous) : null;
            const allDone = sets.every((s) => s.done);

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
                    `${exercise ? `${exercise.sets}×${exercise.repRange}` : ''}${
                      exercise?.note ? ` · ${exercise.note}` : ''
                    }`,
                  ),
                ),
                when(allDone, () => badge('✓', 'accent')),
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

              when(!readOnly && !allDone, () =>
                button('Alles afvinken', {
                  variant: 'sm ghost',
                  onclick: () => completeExercise(name),
                }),
              ),
            );
          }),
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
