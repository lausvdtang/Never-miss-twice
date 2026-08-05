import { el, when } from '../dom.js';
import {
  HABIT_FORMATION,
  SPLIT_LABELS,
  defaultDayAssignment,
  splitForDays,
} from '../presets.js';
import { DAY_NAMES, nl, weekKey } from '../date.js';
import { PHASE_DESCRIPTIONS, PHASE_LABELS, macroTargets } from '../nutrition.js';
import { getState, nowISO, update } from '../store.js';
import { badge, button, card, chip, field, segment, stepper, tapFeedback } from '../ui.js';

/**
 * Onboarding in vijf schermen, één vraag per scherm. Alles is later te wijzigen;
 * niets hier is definitief en dat staat er ook bij.
 */
const draft = {
  step: 0,
  name: '',
  weight: null,
  height: null,
  birthYear: null,
  phase: 'recomp',
  teachingDays: [1, 3, 5],
  days: 6,
};

let rerender = () => {};

export function setOnboardingRerender(fn) {
  rerender = fn;
}

export function renderOnboarding() {
  const state = getState();
  if (draft.weight === null) draft.weight = state.profile.weightKg;
  if (draft.height === null) draft.height = state.profile.heightCm;
  if (draft.birthYear === null) draft.birthYear = state.profile.birthYear;

  const preview = macroTargets({
    ...state.profile,
    weightKg: draft.weight,
    heightCm: draft.height,
    birthYear: draft.birthYear,
    phase: draft.phase,
  });

  function finish() {
    const week = weekKey();
    update((s) => {
      s.profile = {
        ...s.profile,
        name: draft.name.trim(),
        weightKg: draft.weight,
        heightCm: draft.height,
        birthYear: draft.birthYear,
        phase: draft.phase,
        teachingDays: draft.teachingDays,
        proteinPerKg: draft.phase === 'cut' ? 2.0 : 1.8,
        onboarded: true,
      };
      const split = splitForDays(draft.days);
      const templates = s.templates
        .filter((t) => t.split === split)
        .sort((a, b) => a.order - b.order);
      const weekdays = defaultDayAssignment(draft.days);
      s.checkIns = [
        ...s.checkIns.filter((c) => c.week !== week),
        { week, availableDays: draft.days, energy: 3, adjust: '', completedAt: nowISO() },
      ];
      s.weekPlans = [
        ...s.weekPlans.filter((p) => p.week !== week),
        {
          week,
          split,
          assignments: weekdays.map((d, i) => ({
            day: d,
            templateId: templates[i]?.id ?? templates[0]?.id ?? '',
          })),
        },
      ];
    });
    tapFeedback(true);
  }

  const steps = [
    /* 0 — welkom */
    () =>
      el(
        'div',
        { class: 'stack' },
        el('h1', {}, 'Never Miss Twice'),
        el(
          'p',
          { class: 'muted' },
          'Een systeem in plaats van wilskracht. Je logt in een paar tikken, het schema past zich aan jouw week aan, en één gemiste dag is gewoon een gemiste dag.',
        ),
        card(
          'flat',
          el('h3', {}, 'De enige regel'),
          el(
            'p',
            { class: 'muted' },
            'Nooit twee keer op rij overslaan. Eén dag missen doet niets met je gewoonte — twee op rij is het moment waarop de app je een kleine, concrete stap aanbiedt.',
          ),
        ),
        card(
          'flat',
          el('h3', {}, 'Hoe lang duurt dit?'),
          el(
            'p',
            { class: 'muted' },
            `Gemiddeld voelt een gewoonte na zo'n ${HABIT_FORMATION.averageDays} dagen automatisch, met een spreiding van ${HABIT_FORMATION.rangeLow} tot ${HABIT_FORMATION.rangeHigh} dagen. Met ADHD duurt het vaak langer — ${HABIT_FORMATION.adhdMonthsLow} tot ${HABIT_FORMATION.adhdMonthsHigh} maanden is normaal. Dat is geen probleem, dat is de spreiding.`,
          ),
        ),
      ),

    /* 1 — naam */
    () =>
      el(
        'div',
        { class: 'stack' },
        el('h1', {}, 'Hoe mag ik je noemen?'),
        el('p', { class: 'muted' }, 'Alleen voor de begroeting. Overslaan mag ook.'),
        el('input', {
          class: 'input',
          value: draft.name,
          placeholder: 'Je naam',
          // Geen hertekening tijdens typen: dat zou de focus wegnemen.
          oninput: (e) => {
            draft.name = e.target.value;
          },
        }),
      ),

    /* 2 — lichaam */
    () =>
      el(
        'div',
        { class: 'stack' },
        el('h1', {}, 'Wat zijn je cijfers?'),
        el(
          'p',
          { class: 'muted' },
          'Hiermee rekent de app je calorie- en eiwitdoel uit. Later aan te passen.',
        ),
        field(
          'Gewicht',
          stepper({
            value: draft.weight,
            onChange: (v) => {
              draft.weight = v;
              rerender();
            },
            step: 0.5,
            min: 35,
            max: 250,
            unit: 'kg',
            format: (v) => nl(v),
            label: 'Gewicht',
          }),
        ),
        field(
          'Lengte',
          stepper({
            value: draft.height,
            onChange: (v) => {
              draft.height = v;
              rerender();
            },
            step: 1,
            min: 130,
            max: 230,
            unit: 'cm',
            label: 'Lengte',
          }),
        ),
        field(
          'Geboortejaar',
          stepper({
            value: draft.birthYear,
            onChange: (v) => {
              draft.birthYear = v;
              rerender();
            },
            step: 1,
            min: 1930,
            max: new Date().getFullYear() - 12,
            label: 'Geboortejaar',
          }),
        ),
      ),

    /* 3 — fase */
    () =>
      el(
        'div',
        { class: 'stack' },
        el('h1', {}, 'Wat is je doel nu?'),
        segment({
          value: draft.phase,
          ariaLabel: 'Fase',
          options: ['recomp', 'leanbulk', 'cut'].map((p) => ({
            value: p,
            label: PHASE_LABELS[p],
          })),
          onChange: (v) => {
            draft.phase = v;
            rerender();
          },
        }),
        el('p', { class: 'muted' }, PHASE_DESCRIPTIONS[draft.phase]),
        card(
          'flat',
          el(
            'div',
            { class: 'row-between' },
            el('span', { class: 'muted' }, 'Je dagbudget wordt'),
            badge(`${preview.kcal} kcal`, 'accent'),
          ),
          el(
            'div',
            { class: 'row-between' },
            el('span', { class: 'faint' }, 'Eiwit'),
            el('span', { class: 'faint' }, `${preview.proteinG} g per dag`),
          ),
        ),
        el(
          'p',
          { class: 'faint' },
          'Zichtbare buikspieren komen voor ongeveer 90% uit een laag vetpercentage en maar 10% uit abs-training. Het richtpunt is 10-12% lichaamsvet.',
        ),
      ),

    /* 4 — rooster */
    () =>
      el(
        'div',
        { class: 'stack' },
        el('h1', {}, 'Hoe ziet je week eruit?'),
        field(
          'Op welke dagen sta je voor de klas?',
          el(
            'div',
            { class: 'row wrap' },
            ...DAY_NAMES.map((n, i) => {
              const wd = i + 1;
              const on = draft.teachingDays.includes(wd);
              return chip(n, {
                on,
                onclick: () => {
                  draft.teachingDays = on
                    ? draft.teachingDays.filter((d) => d !== wd)
                    : [...draft.teachingDays, wd].sort();
                  rerender();
                },
              });
            }),
          ),
          el(
            'p',
            { class: 'faint' },
            'Op lesdagen krijg je de voorkeur om vóór het werk te trainen.',
          ),
        ),
        field(
          'Hoeveel dagen wil je deze week trainen?',
          el(
            'div',
            { class: 'row wrap' },
            ...[3, 4, 5, 6].map((d) =>
              chip(String(d), {
                on: draft.days === d,
                narrow: true,
                onclick: () => {
                  draft.days = d;
                  rerender();
                },
              }),
            ),
          ),
        ),
        card(
          'flat',
          el('h3', {}, SPLIT_LABELS[splitForDays(draft.days)]),
          el(
            'p',
            { class: 'muted' },
            'Elke spiergroep komt minstens 2× per week aan bod. Volgende week kun je dit aantal bij de check-in gewoon weer bijstellen.',
          ),
        ),
      ),
  ];

  const isLast = draft.step === steps.length - 1;

  return el(
    'div',
    { class: 'screen' },
    el(
      'div',
      { class: 'progress-dots' },
      ...steps.map((_, i) => el('span', { class: i <= draft.step ? 'on' : '' })),
    ),
    el('div', { class: 'stack', style: { flex: '1' } }, steps[draft.step]()),
    button(isLast ? 'Beginnen' : 'Volgende', {
      variant: 'primary xl block',
      onclick: () => {
        if (isLast) {
          finish();
        } else {
          draft.step += 1;
          rerender();
        }
      },
    }),
    when(draft.step > 0, () =>
      button('Terug', {
        variant: 'quiet block',
        onclick: () => {
          draft.step -= 1;
          rerender();
        },
      }),
    ),
  );
}
