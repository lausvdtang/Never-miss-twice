import { el, when } from '../dom.js';
import { ALCOHOL_PRESETS, MINIMAL_VERSION_TEXT } from '../presets.js';
import {
  addMonths,
  formatDay,
  formatDayShort,
  formatMonth,
  greeting,
  today,
} from '../date.js';
import { collectNudges, completionMessage } from '../habits.js';
import { go } from '../nav.js';
import { macroTargets } from '../nutrition.js';
import {
  calendarMarks,
  dailyTotals,
  habitStates,
  healthyDayCount,
  isHealthyDay,
  needsCheckIn,
  planForDay,
  stepsOn,
  supplementsOn,
} from '../selectors.js';
import { getState, newId, nowISO, update } from '../store.js';
import { hoursSinceLastSession, loggedSets, sessionCounts } from '../training.js';
import {
  badge,
  bar,
  button,
  calendar,
  card,
  cardTitle,
  check,
  chip,
  closeSheet,
  openSheet,
  ring,
  tapFeedback,
  toast,
} from '../ui.js';
import { openAlcoholSheet, openFoodSheet } from './sheets.js';
import { startSession } from './training.js';

/** Welke maand de agenda toont. Blijft staan tussen hertekeningen door. */
let visibleMonth = today();
let rerender = () => {};

export function setTodayRerender(fn) {
  rerender = fn;
}

export function renderToday() {
  const state = getState();
  const day = today();

  const plan = planForDay(state, day);
  const targets = macroTargets(state.profile);
  const totals = dailyTotals(state, day);
  const habits = habitStates(state, day);
  const nudges = collectNudges(habits, state.dismissedNudges, day);
  const supplementsTaken = supplementsOn(state, day);
  const steps = stepsOn(state, day);

  const sessionDone = sessionCounts(plan.session);
  // Wel getraind, maar nooit op "afronden" getikt: dat mag je zien én hervatten.
  const stillOpen = sessionDone && plan.session.status === 'bezig';
  const restDay = !plan.template;
  const kcalLeft = targets.kcal - totals.kcal;
  const healthyToday = isHealthyDay(state, day);

  /* ------------------------------------------------------- acties */

  function toggleHabit(habitId, minimal = false) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const existing = state.habitLogs.find((l) => l.habitId === habitId && l.day === day);
    update((s) => {
      s.habitLogs = existing
        ? s.habitLogs.filter((l) => !(l.habitId === habitId && l.day === day))
        : [
            ...s.habitLogs,
            { habitId, day, completion: minimal ? 'minimaal' : 'vol', loggedAt: nowISO() },
          ];
    });
    if (!existing) {
      tapFeedback(state.settings.celebrate);
      toast(completionMessage(habit, minimal), true);
    }
  }

  function toggleSupplement(key) {
    const log = state.supplementLogs.find((l) => l.day === day);
    const taken = log?.taken ?? [];
    const next = taken.includes(key) ? taken.filter((k) => k !== key) : [...taken, key];
    update((s) => {
      s.supplementLogs = log
        ? s.supplementLogs.map((l) => (l.day === day ? { ...l, taken: next } : l))
        : [...s.supplementLogs, { day, taken: next }];
    });
    if (!taken.includes(key)) tapFeedback(state.settings.celebrate);
  }

  function addSteps(delta) {
    update((s) => {
      const existing = s.steps.find((x) => x.day === day);
      const next = Math.max(0, (existing?.steps ?? 0) + delta);
      s.steps = existing
        ? s.steps.map((x) => (x.day === day ? { ...x, steps: next } : x))
        : [...s.steps, { day, steps: next }];
    });
    if (delta > 0) tapFeedback(state.settings.celebrate);
  }

  function dismissNudge(key) {
    update((s) => {
      s.dismissedNudges = [...s.dismissedNudges, key];
    });
  }

  /**
   * Groene dag aan of uit. Werkt ook op eerdere dagen: vergeten invullen hoort
   * erbij en mag geen reden zijn om het maar helemaal te laten.
   */
  function toggleHealthy(target) {
    const current = state.healthyDays ?? [];
    const on = current.includes(target);
    update((s) => {
      s.healthyDays = on
        ? current.filter((d) => d !== target)
        : [...current, target].sort();
    });
    if (!on) {
      tapFeedback(state.settings.celebrate);
      toast(
        target === day
          ? 'Ik ben iemand die goed voor zichzelf eet.'
          : `${formatDayShort(target)} op groen gezet.`,
        true,
      );
    }
  }

  /** "Even geen dag": de sessie wordt de minimale versie, nooit een misser. */
  function logBadDay() {
    const existing = plan.session;
    update((s) => {
      if (existing) {
        s.sessions = s.sessions.map((x) =>
          x.id === existing.id
            ? {
                ...x,
                status: 'minimaal',
                finishedAt: nowISO(),
                minimalNote: MINIMAL_VERSION_TEXT,
              }
            : x,
        );
      } else {
        s.sessions = [
          ...s.sessions,
          {
            id: newId('ses'),
            day,
            templateId: plan.template?.id ?? null,
            templateName: plan.template?.name ?? 'Minimale versie',
            status: 'minimaal',
            startedAt: nowISO(),
            finishedAt: nowISO(),
            sets: [],
            minimalNote: MINIMAL_VERSION_TEXT,
          },
        ];
      }
    });
    closeSheet();
    tapFeedback(state.settings.celebrate);
    toast('Ik ben iemand die traint. Ook vandaag — dit telt volledig mee.', true);
  }

  function openBadDaySheet() {
    openSheet({
      title: 'Even geen dag',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          el(
            'p',
            { class: 'muted' },
            'Prima. We zetten de sessie om naar de kleinste versie — dat telt volledig mee en je streak loopt gewoon door.',
          ),
          card(
            'flat',
            el('h3', {}, MINIMAL_VERSION_TEXT),
            el(
              'p',
              { class: 'faint' },
              plan.template
                ? `Bijvoorbeeld: ${
                    plan.template.exercises.find((e) => e.isKeystone)?.name ??
                    plan.template.exercises[0]?.name
                  }, één set.`
                : 'Kies één oefening die je in vijf minuten doet.',
            ),
          ),
          button('Zo doen we het', { variant: 'primary lg block', onclick: logBadDay }),
          button('Terug', { variant: 'quiet block', onclick: closeSheet }),
        ),
    });
  }

  /* -------------------------------------------------------- render */

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow' }, formatDay(day)),
        el('h1', {}, `${greeting()}${state.profile.name ? `, ${state.profile.name}` : ''}`),
      ),
      button('⚙︎', {
        variant: 'icon ghost',
        ariaLabel: 'Instellingen',
        onclick: () => go('instellingen'),
      }),
    ),

    /*
      Never miss twice — staat bovenaan omdat dit de kern van de app is.
      Bewust maar één kaart tegelijk: vijf "je hebt twee dagen overgeslagen"-
      kaarten op een rij is precies de overweldiging waar deze app tegen
      bedoeld is, en het duwt de primaire actie onder de vouw. De volgende
      verschijnt vanzelf zodra deze is afgehandeld.
    */
    when(nudges.length > 0, () => {
      const n = nudges[0];
      return card(
        n.tone === 'herstel' ? 'attention' : 'calm',
        cardTitle(
          el('h3', {}, n.title),
          button('✕', {
            variant: 'quiet sm',
            ariaLabel: 'Sluiten',
            onclick: () => dismissNudge(n.key),
          }),
        ),
        el('p', { class: 'muted' }, n.body),
        button(n.actionLabel, {
          variant: 'primary block',
          onclick: () => {
            toggleHabit(n.habitId, n.tone === 'herstel');
            dismissNudge(n.key);
          },
        }),
        when(nudges.length > 1, () =>
          el(
            'p',
            { class: 'faint' },
            `Er wachten nog ${nudges.length - 1} andere. Eén tegelijk is genoeg — de volgende verschijnt hierna.`,
          ),
        ),
      );
    }),

    when(needsCheckIn(state, day), () =>
      card(
        'calm',
        el(
          'div',
          { class: 'row-between' },
          el(
            'div',
            { class: 'grow' },
            el('h3', {}, 'Weekcheck-in'),
            el('p', { class: 'muted' }, 'Drie vragen. Bepaalt je schema voor deze week.'),
          ),
          button('Start', { variant: 'primary', onclick: () => go('week') }),
        ),
      ),
    ),

    /* Eén primaire actie per scherm: de training van vandaag. */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Vandaag trainen'),
        when(plan.isTeachingDay, () => badge(`Lesdag · ${plan.preferredTime}`, 'calm')),
      ),
      ...(sessionDone
        ? [
            el(
              'h2',
              {},
              plan.session.status === 'minimaal'
                ? 'Minimale versie gedaan'
                : `${plan.session.templateName} — ${stillOpen ? 'bezig' : 'klaar'}`,
            ),
            el(
              'p',
              { class: 'muted' },
              stillOpen
                ? `${loggedSets(plan.session).length} sets gelogd. Telt al mee — je kunt gewoon verder.`
                : 'Ik ben iemand die traint. Vandaag klopt dat weer.',
            ),
            when(plan.session.sets.length > 0, () =>
              button(stillOpen ? `Verder met ${plan.session.templateName}` : 'Sessie bekijken', {
                variant: stillOpen ? 'primary lg block' : 'ghost block',
                onclick: () => go('sessie', plan.session.id),
              }),
            ),
          ]
        : restDay
          ? [
              el('h2', {}, 'Rustdag'),
              el(
                'p',
                { class: 'muted' },
                'Herstel is onderdeel van het schema. Wil je toch bewegen: een wandeling of 20-30 min zone-2 past prima vandaag.',
              ),
              button('Toch trainen of cardio loggen', {
                variant: 'ghost block',
                onclick: () => go('training'),
              }),
            ]
          : [
              el('h2', {}, plan.template.name),
              el(
                'p',
                { class: 'muted' },
                `${plan.template.exercises.length} oefeningen · 45-60 min${
                  plan.preferredTime !== 'flexibel' ? ` · ${plan.preferredTime}` : ''
                }`,
              ),
              button(`Start ${plan.template.name}`, {
                variant: 'primary xl block',
                sub: `Eerste oefening: ${plan.template.exercises[0]?.name}`,
                onclick: () => go('sessie', startSession(day)),
              }),
              button('Even geen dag vandaag', {
                variant: 'quiet block',
                onclick: openBadDaySheet,
              }),
            ]),
    ),

    /* Voeding compact: ring voor kcal, balk voor eiwit. */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Voeding'),
        button('Alles →', { variant: 'quiet sm', onclick: () => go('voeding') }),
      ),
      el(
        'div',
        { class: 'ring-wrap' },
        ring({
          value: totals.kcal,
          max: targets.kcal,
          label: String(Math.max(0, Math.round(kcalLeft))),
          unit: kcalLeft >= 0 ? 'kcal over' : 'kcal boven',
        }),
        el(
          'div',
          { class: 'grow stack-sm' },
          el(
            'div',
            { class: 'row-between' },
            el('span', { class: 'muted' }, 'Eiwit'),
            el(
              'span',
              { class: 'muted' },
              `${Math.round(totals.proteinG)} / ${targets.proteinG} g`,
            ),
          ),
          bar({ value: totals.proteinG, max: targets.proteinG }),
          when(totals.alcoholKcal > 0, () =>
            el(
              'p',
              { class: 'faint' },
              `Waarvan ${Math.round(totals.alcoholKcal)} kcal uit ${totals.alcoholGlasses
                .toFixed(1)
                .replace('.', ',')} standaardglazen.`,
            ),
          ),
        ),
      ),
      el(
        'div',
        { class: 'grid-2' },
        button('+ Eten', { variant: 'lg', onclick: () => openFoodSheet(day) }),
        button('+ Biertje', {
          variant: 'lg free',
          onclick: () =>
            openAlcoholSheet(
              day,
              ALCOHOL_PRESETS,
              hoursSinceLastSession(state.sessions),
              state.settings.alcoholRecoveryHint,
            ),
        }),
      ),
    ),

    /*
      Agenda met groene dagen. Eén tap per dag, ook terugwerkend, en een
      stipje op de dagen waarop getraind is. Geen rood voor een niet-groene
      dag: dat is gewoon een dag zonder markering.
    */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Gezond gegeten'),
        badge(`${healthyDayCount(state, 30)}× in 30 dagen`, 'accent'),
      ),
      button(healthyToday ? '✓ Vandaag staat op groen' : 'Vandaag helemaal gezond gegeten', {
        variant: healthyToday ? 'ghost block' : 'primary lg block',
        onclick: () => toggleHealthy(day),
      }),
      calendar({
        monthAnchor: visibleMonth,
        marks: calendarMarks(state),
        today: day,
        monthLabel: formatMonth(visibleMonth),
        onToggle: toggleHealthy,
        onPrev: () => {
          visibleMonth = addMonths(visibleMonth, -1);
          rerender();
        },
        onNext: () => {
          visibleMonth = addMonths(visibleMonth, 1);
          rerender();
        },
      }),
      el(
        'div',
        { class: 'row wrap faint' },
        el('span', { class: 'legend' }, el('span', { class: 'legend-swatch healthy' }), 'gezond'),
        el('span', { class: 'legend' }, el('span', { class: 'legend-swatch dot' }), 'getraind'),
        el('span', {}, 'Tik een dag aan om hem alsnog groen te maken.'),
      ),
    ),

    /* Dagelijkse afvinklijst: alles in één tap per item. */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Vandaag afvinken'),
        button('Alles →', { variant: 'quiet sm', onclick: () => go('gewoontes') }),
      ),
      el(
        'div',
        { class: 'list' },
        ...habits
          .filter((h) => h.activeToday)
          .map((h) =>
            el(
              'button',
              {
                class: 'list-item',
                disabled: !!h.habit.autoSource && h.doneToday,
                onclick: () => toggleHabit(h.habit.id),
              },
              check(h.doneToday),
              el(
                'span',
                { class: 'grow' },
                el('span', { class: 'title' }, `${h.habit.icon} ${h.habit.name}`),
                el(
                  'span',
                  { class: 'faint' },
                  h.doneToday ? h.habit.identity : h.habit.anchor || h.habit.minimalVersion,
                ),
              ),
              when(h.streak > 0, () => badge(String(h.streak), 'accent')),
            ),
          ),
      ),
    ),

    /* Supplementen: creatine bovenaan, want hoogste prioriteit. */
    card(
      null,
      el('p', { class: 'eyebrow' }, 'Supplementen'),
      el(
        'div',
        { class: 'row wrap' },
        ...state.supplements
          .filter((s) => s.enabled)
          .sort((a, b) => a.priority - b.priority)
          .map((s) => {
            const on = supplementsTaken.includes(s.key);
            const label = `${on ? '✓ ' : ''}${s.name}${
              s.key === 'creatine' && !on ? ` · ${s.dose}` : ''
            }`;
            return chip(label, { on, onclick: () => toggleSupplement(s.key) });
          }),
      ),
      when(!supplementsTaken.includes('creatine'), () =>
        el(
          'p',
          { class: 'faint' },
          'Creatine ook op rustdagen — dat is het enige supplement dat elke dag telt.',
        ),
      ),
    ),

    /* Stappen: één tap per bijstelling van 1.000. */
    card(
      null,
      el(
        'div',
        { class: 'row-between' },
        el(
          'div',
          { class: 'grow' },
          el('p', { class: 'eyebrow' }, 'Stappen'),
          el(
            'h3',
            {},
            steps.toLocaleString('nl-NL'),
            el(
              'span',
              { class: 'muted', style: { fontWeight: '400' } },
              ` / ${state.profile.stepGoal.toLocaleString('nl-NL')}`,
            ),
          ),
        ),
        el(
          'div',
          { class: 'row' },
          button('−', {
            variant: 'ghost icon',
            ariaLabel: 'Duizend stappen minder',
            onclick: () => addSteps(-1000),
          }),
          button('+', {
            variant: 'ghost icon',
            ariaLabel: 'Duizend stappen erbij',
            onclick: () => addSteps(1000),
          }),
        ),
      ),
      bar({ value: steps, max: state.profile.stepGoal, color: 'var(--calm)' }),
    ),
  );
}
