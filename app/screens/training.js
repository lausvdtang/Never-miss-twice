import { el, when } from '../dom.js';
import { CARDIO_GUIDANCE, SPLIT_LABELS } from '../presets.js';
import { DAY_NAMES, formatDayShort, today } from '../date.js';
import { go } from '../nav.js';
import {
  availableDaysForWeek,
  planForDay,
  splitForWeek,
  weekCardio,
  weekSchedule,
} from '../selectors.js';
import { getState, newId, nowISO, update } from '../store.js';
import {
  cardioInterferenceWarning,
  loggedSets,
  runsThisWeek,
  seedSets,
  sessionCounts,
  sessionVolume,
  weeklyCardioMinutes,
} from '../training.js';
import { changeLabel, progressSummary, volumeSeries } from '../progress.js';
import {
  badge,
  barChart,
  button,
  card,
  cardTitle,
  chip,
  closeSheet,
  openSheet,
  refreshSheet,
  stepper,
  tapFeedback,
  toast,
} from '../ui.js';

/**
 * Start (of hervat) de sessie van een dag en geeft het sessie-id terug.
 * Sets worden meteen voorgevuld met het progressive-overload-voorstel, zodat
 * de gebruiker in de sportschool alleen nog hoeft te bevestigen.
 */
export function startSession(day) {
  const state = getState();
  const existing = state.sessions.find((s) => s.day === day && s.status !== 'gemist');
  if (existing) {
    if (existing.status === 'gepland') {
      update((s) => {
        s.sessions = s.sessions.map((x) =>
          x.id === existing.id ? { ...x, status: 'bezig', startedAt: nowISO() } : x,
        );
      });
    }
    return existing.id;
  }

  const plan = planForDay(state, day);
  const id = newId('ses');
  const now = nowISO();
  update((s) => {
    s.sessions = [
      ...s.sessions,
      {
        id,
        day,
        templateId: plan.template?.id ?? null,
        templateName: plan.template?.name ?? 'Vrije sessie',
        status: 'bezig',
        startedAt: now,
        finishedAt: null,
        sets: plan.template ? seedSets(plan.template.exercises, s.sessions, now) : [],
      },
    ];
  });
  return id;
}

function openCardioSheet(day) {
  let kind = 'hardlopen';
  let minutes = 25;

  const kinds = [
    { value: 'hardlopen', label: 'Hardlopen' },
    { value: 'zone2', label: 'Zone 2' },
    { value: 'wandelen', label: 'Wandelen' },
    { value: 'fietsen', label: 'Fietsen' },
  ];

  openSheet({
    title: 'Cardio loggen',
    render: () =>
      el(
        'div',
        { class: 'stack' },
        el(
          'div',
          { class: 'row wrap' },
          ...kinds.map((k) =>
            chip(k.label, {
              on: kind === k.value,
              onclick: () => {
                kind = k.value;
                refreshSheet();
              },
            }),
          ),
        ),
        el(
          'div',
          { class: 'row-between' },
          el('span', { class: 'muted' }, 'Minuten'),
          stepper({
            value: minutes,
            onChange: (v) => {
              minutes = v;
              refreshSheet();
            },
            step: 5,
            min: 5,
            max: 180,
            unit: 'min',
            label: 'Minuten',
          }),
        ),
        button('Loggen', {
          variant: 'primary lg block',
          onclick: () => {
            update((s) => {
              s.cardio = [
                ...s.cardio,
                { id: newId('cardio'), day, kind, minutes, loggedAt: nowISO() },
              ];
            });
            tapFeedback(getState().settings.celebrate);
            toast('Ik ben iemand die elke dag beweegt.', true);
            closeSheet();
          },
        }),
      ),
  });
}

/**
 * "Iets anders gedaan": een sessie loggen die niet in het schema staat —
 * zwemmen, een partijtje voetbal, klussen. Telt gewoon mee als getraind, want
 * de bedoeling is bewegen, niet het schema afvinken.
 */
function openSomethingElseSheet(day) {
  let name = '';
  const suggestions = ['Zwemmen', 'Voetbal', 'Fietsen', 'Klussen', 'Wandeling', 'Thuisworkout'];

  openSheet({
    title: 'Iets anders gedaan',
    render() {
      const input = el('input', {
        class: 'input',
        placeholder: 'Wat heb je gedaan?',
        'aria-label': 'Wat heb je gedaan',
        oninput: (e) => {
          name = e.target.value;
        },
      });

      const save = () => {
        const label = name.trim();
        if (!label) {
          toast('Vul even in wat je gedaan hebt.');
          return;
        }
        update((s) => {
          s.sessions = [
            ...s.sessions.filter((x) => !(x.day === day && x.status === 'gepland')),
            {
              id: newId('ses'),
              day,
              templateId: null,
              templateName: label,
              status: 'voltooid',
              startedAt: nowISO(),
              finishedAt: nowISO(),
              sets: [],
              notes: 'Buiten het schema om gelogd.',
            },
          ];
        });
        closeSheet();
        tapFeedback(getState().settings.celebrate);
        toast('Ik ben iemand die traint. Telt gewoon mee.', true);
        go('vandaag');
      };

      return el(
        'div',
        { class: 'stack' },
        el(
          'p',
          { class: 'muted' },
          'Alles telt mee. Dit vervangt de training van vandaag en houdt je streak gewoon lopend.',
        ),
        el(
          'div',
          { class: 'row wrap' },
          ...suggestions.map((s) =>
            chip(s, {
              outline: true,
              onclick: () => {
                name = s;
                input.value = s;
                save();
              },
            }),
          ),
        ),
        input,
        button('Loggen', { variant: 'primary lg block', onclick: save }),
      );
    },
  });
}

function openPickerSheet(day, split) {
  openSheet({
    title: 'Welke sessie?',
    render: () =>
      el(
        'div',
        { class: 'stack-sm' },
        ...getState()
          .templates.filter((t) => t.split === split)
          .sort((a, b) => a.order - b.order)
          .map((t) =>
            el(
              'button',
              {
                class: 'btn lg block split',
                onclick: () => {
                  const id = newId('ses');
                  const now = nowISO();
                  update((s) => {
                    s.sessions = [
                      ...s.sessions.filter((x) => !(x.day === day && x.status === 'gepland')),
                      {
                        id,
                        day,
                        templateId: t.id,
                        templateName: t.name,
                        status: 'bezig',
                        startedAt: now,
                        finishedAt: null,
                        sets: seedSets(t.exercises, s.sessions, now),
                      },
                    ];
                  });
                  closeSheet();
                  tapFeedback(getState().settings.celebrate);
                  toast(`${t.name} gestart`);
                  go('sessie', id);
                },
              },
              el('span', {}, t.name),
              el('span', { class: 'faint' }, `${t.exercises.length} oefeningen`),
            ),
          ),
      ),
  });
}

export function renderTraining() {
  const state = getState();
  const day = today();

  const schedule = weekSchedule(state, day);
  const split = splitForWeek(state);
  const plannedDays = availableDaysForWeek(state);
  const cardio = weekCardio(state, day);
  const plan = planForDay(state, day);

  const done = schedule.filter((d) => sessionCounts(d.session)).length;

  const history = [...state.sessions]
    .filter(sessionCounts)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 12);

  // Alleen schema's waar iets te vergelijken valt: één sessie is geen verloop.
  const progressTemplates = [...new Set(state.sessions.map((s) => s.templateName))]
    .map((name) => ({ name, series: volumeSeries(state.sessions, name, { limit: 8 }) }))
    .filter((t) => t.series.length >= 2)
    .sort((a, b) => b.series.length - a.series.length)
    .slice(0, 4);

  const warning = cardioInterferenceWarning(!!plan.template, sessionCounts(plan.session));

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
        el('h1', {}, SPLIT_LABELS[split]),
      ),
      badge(`${done}/${plannedDays}`, 'accent'),
    ),

    el(
      'p',
      { class: 'muted' },
      'Elke spiergroep komt in dit schema minstens 2× per week aan bod. Dat is de enige harde regel — de rest past zich aan jouw week aan.',
    ),

    /* Weekoverzicht: één regel per dag, direct te starten. */
    card(
      null,
      el('p', { class: 'eyebrow' }, 'Deze week'),
      el(
        'div',
        { class: 'list' },
        ...schedule.map((d) => {
          const isToday = d.day === day;
          const finished = sessionCounts(d.session);
          // Wel getraind, maar nog niet afgerond: dat mag je zien.
          const stillOpen = finished && d.session.status === 'bezig';
          return el(
            'button',
            {
              class: 'list-item',
              disabled: !d.template && !finished,
              onclick: () => {
                if (finished && d.session) go('sessie', d.session.id);
                else if (d.template && isToday) go('sessie', startSession(d.day));
              },
            },
            el(
              'span',
              {
                class: 'faint',
                style: {
                  width: '26px',
                  fontWeight: '700',
                  color: isToday ? 'var(--accent)' : '',
                },
              },
              DAY_NAMES[d.weekday - 1],
            ),
            el(
              'span',
              { class: 'grow' },
              el('span', { class: 'title' }, d.template ? d.template.name : 'Rust of actief herstel'),
              el(
                'span',
                { class: 'faint' },
                finished
                  ? d.session.status === 'minimaal'
                    ? 'Minimale versie — telt mee'
                    : `${stillOpen ? 'Bezig' : 'Voltooid'} · ${Math.round(
                        sessionVolume(d.session),
                      ).toLocaleString('nl-NL')} kg volume`
                  : d.isTeachingDay
                    ? `Lesdag · voorkeur ${d.preferredTime}`
                    : d.template
                      ? `${d.template.exercises.length} oefeningen · 45-60 min`
                      : '—',
              ),
            ),
            when(finished, () => badge('✓', 'accent')),
            when(isToday && !finished && !!d.template, () => badge('Start')),
          );
        }),
      ),
    ),

    when(!!plan.template && !plan.session, () =>
      button(`Start ${plan.template.name}`, {
        variant: 'primary xl block',
        sub: 'Vandaag · 45-60 min',
        onclick: () => go('sessie', startSession(day)),
      }),
    ),

    /* Cardio staat los van het krachtschema (§3A). */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Cardio'),
        badge(`${runsThisWeek(cardio)}/${CARDIO_GUIDANCE.runsPerWeekMax} deze week`, 'calm'),
      ),
      el(
        'p',
        { class: 'muted' },
        `${CARDIO_GUIDANCE.runsPerWeekMin}-${CARDIO_GUIDANCE.runsPerWeekMax}× per week ${CARDIO_GUIDANCE.runMinutesMin}-${CARDIO_GUIDANCE.runMinutesMax} min zone-2, op rustdagen of ná het krachttrainen.`,
      ),
      when(!!warning, () => card('calm', el('p', { class: 'muted' }, warning))),
      el(
        'div',
        { class: 'row-between' },
        el('span', { class: 'faint' }, `${weeklyCardioMinutes(cardio)} min deze week`),
        button('+ Cardio loggen', { onclick: () => openCardioSheet(day) }),
      ),
    ),

    card(
      null,
      cardTitle(el('p', { class: 'eyebrow' }, 'Iets anders doen')),
      el(
        'p',
        { class: 'muted' },
        'Schema van vandaag past niet? Het schema is een hulpmiddel, geen contract.',
      ),
      el(
        'div',
        { class: 'grid-2' },
        button('Andere sessie', {
          variant: 'ghost',
          onclick: () => openPickerSheet(day, split),
        }),
        button('Iets anders gedaan', {
          variant: 'ghost',
          onclick: () => openSomethingElseSheet(day),
        }),
      ),
    ),

    /* Voortgang per training: doe ik steeds meer? */
    when(progressTemplates.length > 0, () =>
      card(
        null,
        cardTitle(
          el('p', { class: 'eyebrow' }, 'Voortgang per training'),
          badge('volume', 'calm'),
        ),
        el(
          'div',
          { class: 'stack' },
          ...progressTemplates.map(({ name, series }) => {
            const change = changeLabel(series);
            return el(
              'div',
              { class: 'stack-sm' },
              el(
                'div',
                { class: 'row-between' },
                el('span', { style: { fontWeight: '600' } }, name),
                el(
                  'span',
                  { class: 'row' },
                  el(
                    'span',
                    { class: 'faint' },
                    `${series[series.length - 1].value.toLocaleString('nl-NL')} kg`,
                  ),
                  badge(change.text, change.tone),
                ),
              ),
              barChart(series, {
                height: 74,
                formatValue: (v) => `${v.toLocaleString('nl-NL')} kg`,
              }),
              el('p', { class: 'faint' }, progressSummary(series)),
            );
          }),
        ),
      ),
    ),

    when(history.length > 0, () =>
      card(
        null,
        el('p', { class: 'eyebrow' }, 'Eerder'),
        el(
          'div',
          { class: 'list' },
          ...history.map((s) =>
            el(
              'button',
              { class: 'list-item', onclick: () => go('sessie', s.id) },
              el(
                'span',
                { class: 'grow' },
                el('span', { class: 'title' }, s.templateName),
                el(
                  'span',
                  { class: 'faint' },
                  `${formatDayShort(s.day)} · ${
                    s.status === 'minimaal'
                      ? 'minimale versie'
                      : `${loggedSets(s).length} sets`
                  }`,
                ),
              ),
              el(
                'span',
                { class: 'faint' },
                s.status === 'minimaal'
                  ? ''
                  : `${Math.round(sessionVolume(s)).toLocaleString('nl-NL')} kg`,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
