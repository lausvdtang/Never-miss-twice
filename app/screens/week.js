import { el, when } from '../dom.js';
import { PREP_FORMULA, SPLIT_LABELS, defaultDayAssignment, splitForDays } from '../presets.js';
import { DAY_NAMES, today, weekKey } from '../date.js';
import { go } from '../nav.js';
import {
  availableDaysForWeek,
  completedSessionsThisWeek,
  needsCheckIn,
  weekSchedule,
} from '../selectors.js';
import { getState, newId, nowISO, update } from '../store.js';
import {
  badge,
  button,
  card,
  cardTitle,
  check,
  chip,
  closeSheet,
  miniStepper,
  openSheet,
  refreshSheet,
  segment,
  tapFeedback,
  toast,
} from '../ui.js';

function componentLabel(c) {
  return PREP_FORMULA.find((f) => f.component === c)?.label ?? c;
}

/** Max. 3 vragen — geen lang formulier (§3D). */
function openCheckInSheet(week, initialDays) {
  let step = 0;
  let days = initialDays;
  let energy = 3;
  let adjust = '';

  function save() {
    update((s) => {
      s.checkIns = [
        ...s.checkIns.filter((c) => c.week !== week),
        { week, availableDays: days, energy, adjust: adjust.trim(), completedAt: nowISO() },
      ];

      // Weekplan meteen vastleggen op basis van het antwoord.
      const split = splitForDays(days);
      const templates = s.templates
        .filter((t) => t.split === split)
        .sort((a, b) => a.order - b.order);
      const weekdays = defaultDayAssignment(days);
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
    tapFeedback(getState().settings.celebrate);
    toast(`Schema aangepast naar ${SPLIT_LABELS[splitForDays(days)].toLowerCase()}`, true);
    closeSheet();
  }

  openSheet({
    title: 'Weekcheck-in',
    render: () => {
      if (step === 0) {
        return el(
          'div',
          { class: 'stack' },
          el('h3', {}, 'Hoeveel dagen kun je deze week trainen?'),
          el(
            'p',
            { class: 'muted' },
            'Eerlijk inschatten werkt beter dan optimistisch plannen. Het schema past zich aan.',
          ),
          el(
            'div',
            { class: 'row wrap' },
            ...[3, 4, 5, 6].map((d) =>
              chip(String(d), {
                on: days === d,
                narrow: true,
                onclick: () => {
                  days = d;
                  refreshSheet();
                },
              }),
            ),
          ),
          card(
            'flat',
            el('p', { class: 'muted' }, SPLIT_LABELS[splitForDays(days)]),
            el(
              'p',
              { class: 'faint' },
              "Elke spiergroep komt minstens 2× per week aan bod — dat blijft kloppen bij elk van deze schema's.",
            ),
          ),
          button('Volgende', {
            variant: 'primary lg block',
            onclick: () => {
              step = 1;
              refreshSheet();
            },
          }),
        );
      }

      if (step === 1) {
        return el(
          'div',
          { class: 'stack' },
          el('h3', {}, 'Hoe is je energie?'),
          el(
            'div',
            { class: 'row wrap' },
            ...[1, 2, 3, 4, 5].map((e) =>
              chip(String(e), {
                on: energy === e,
                narrow: true,
                onclick: () => {
                  energy = e;
                  refreshSheet();
                },
              }),
            ),
          ),
          el('p', { class: 'faint' }, '1 = op mijn tandvlees · 5 = topfit'),
          button('Volgende', {
            variant: 'primary lg block',
            onclick: () => {
              step = 2;
              refreshSheet();
            },
          }),
          button('Terug', {
            variant: 'quiet block',
            onclick: () => {
              step = 0;
              refreshSheet();
            },
          }),
        );
      }

      return el(
        'div',
        { class: 'stack' },
        el('h3', {}, 'Wil je iets aanpassen?'),
        el('textarea', {
          class: 'input',
          value: adjust,
          placeholder: 'Eén zin is genoeg — of laat leeg.',
          oninput: (e) => {
            adjust = e.target.value;
          },
        }),
        button('Klaar', { variant: 'primary lg block', onclick: save }),
        button('Terug', {
          variant: 'quiet block',
          onclick: () => {
            step = 1;
            refreshSheet();
          },
        }),
      );
    },
  });
}

function openPrepPlanner(week) {
  const existing = getState().mealPrep.find((p) => p.week === week);
  let items = existing ? existing.items.map((i) => ({ ...i })) : [];
  let component = 'eiwit';

  openSheet({
    title: 'Meal prep plannen',
    render: () => {
      const suggestions =
        PREP_FORMULA.find((f) => f.component === component)?.suggestions ?? [];

      return el(
        'div',
        { class: 'stack' },
        el(
          'p',
          { class: 'muted' },
          'Basisformule: eiwitbron + koolhydraatbron + groente + smaakmaker. Kies per onderdeel wat je deze week maakt.',
        ),
        segment({
          value: component,
          ariaLabel: 'Onderdeel',
          options: PREP_FORMULA.map((f) => ({
            value: f.component,
            label: f.label.replace('bron', ''),
          })),
          onChange: (v) => {
            component = v;
            refreshSheet();
          },
        }),
        el(
          'div',
          { class: 'row wrap' },
          ...suggestions.map((s) =>
            chip(`+ ${s}`, {
              outline: true,
              onclick: () => {
                items = [
                  ...items,
                  {
                    id: newId('prep'),
                    name: s,
                    component,
                    portions: 4,
                    emergency: false,
                    done: false,
                  },
                ];
                refreshSheet();
              },
            }),
          ),
        ),
        when(items.length > 0, () =>
          card(
            'flat',
            el('p', { class: 'eyebrow' }, 'Op het plan'),
            el(
              'div',
              { class: 'list' },
              ...items.map((item) =>
                el(
                  'div',
                  { class: 'list-item' },
                  el(
                    'span',
                    { class: 'grow' },
                    el('span', { class: 'title' }, item.name),
                    el('span', { class: 'faint' }, componentLabel(item.component)),
                  ),
                  chip('🆘', {
                    on: item.emergency,
                    outline: !item.emergency,
                    title: 'Noodmaaltijd — moet altijd klaarstaan',
                    onclick: () => {
                      items = items.map((x) =>
                        x.id === item.id ? { ...x, emergency: !x.emergency } : x,
                      );
                      refreshSheet();
                    },
                  }),
                  miniStepper({
                    value: item.portions,
                    min: 1,
                    ariaLabel: `${item.name} porties`,
                    onChange: (v) => {
                      items = items.map((x) =>
                        x.id === item.id ? { ...x, portions: Math.max(1, v) } : x,
                      );
                      refreshSheet();
                    },
                  }),
                  button('✕', {
                    variant: 'quiet sm',
                    ariaLabel: 'Verwijderen',
                    onclick: () => {
                      items = items.filter((x) => x.id !== item.id);
                      refreshSheet();
                    },
                  }),
                ),
              ),
            ),
            el(
              'p',
              { class: 'faint' },
              'Tik op 🆘 om iets als noodmaaltijd te markeren — dat is wat er klaarstaat op een slechte dag.',
            ),
          ),
        ),
        button('Opslaan', {
          variant: 'primary lg block',
          disabled: items.length === 0,
          onclick: () => {
            update((s) => {
              s.mealPrep = [
                ...s.mealPrep.filter((p) => p.week !== week),
                {
                  week,
                  items,
                  extras: existing?.extras ?? [],
                  cookedAt: existing?.cookedAt ?? null,
                },
              ];
            });
            toast('Prep-plan opgeslagen', true);
            closeSheet();
          },
        }),
      );
    },
  });
}

/** Boodschappenlijst, afgeleid van het prep-plan. */
function shoppingList(week) {
  const plan = getState().mealPrep.find((p) => p.week === week);
  if (!plan) return null;

  const input = el('input', {
    class: 'input grow',
    placeholder: 'Iets toevoegen…',
    'aria-label': 'Boodschap toevoegen',
  });

  return card(
    null,
    cardTitle(
      el('p', { class: 'eyebrow' }, 'Boodschappenlijst'),
      el('span', { class: 'faint' }, `${plan.items.length + plan.extras.length} items`),
    ),
    el(
      'div',
      { class: 'list' },
      ...plan.items.map((item) =>
        el(
          'div',
          { class: 'list-item' },
          el(
            'span',
            { class: 'grow' },
            item.name,
            el('span', { class: 'faint' }, ` × ${item.portions} porties`),
          ),
        ),
      ),
      ...plan.extras.map((e) =>
        el(
          'div',
          { class: 'list-item' },
          el(
            'button',
            {
              class: 'row grow',
              style: { background: 'none', textAlign: 'left' },
              onclick: () =>
                update((s) => {
                  s.mealPrep = s.mealPrep.map((p) =>
                    p.week === week
                      ? {
                          ...p,
                          extras: p.extras.map((x) =>
                            x.id === e.id ? { ...x, checked: !x.checked } : x,
                          ),
                        }
                      : p,
                  );
                }),
            },
            check(e.checked),
            el(
              'span',
              { class: 'grow', style: { textDecoration: e.checked ? 'line-through' : '' } },
              e.name,
            ),
          ),
          button('✕', {
            variant: 'quiet sm',
            ariaLabel: 'Verwijderen',
            onclick: () =>
              update((s) => {
                s.mealPrep = s.mealPrep.map((p) =>
                  p.week === week
                    ? { ...p, extras: p.extras.filter((x) => x.id !== e.id) }
                    : p,
                );
              }),
          }),
        ),
      ),
    ),
    el(
      'form',
      {
        class: 'row',
        onsubmit: (ev) => {
          ev.preventDefault();
          const value = input.value.trim();
          if (!value) return;
          update((s) => {
            s.mealPrep = s.mealPrep.map((p) =>
              p.week === week
                ? {
                    ...p,
                    extras: [...p.extras, { id: newId('ex'), name: value, checked: false }],
                  }
                : p,
            );
          });
        },
      },
      input,
      button('+', { type: 'submit' }),
    ),
  );
}

export function renderWeek() {
  const state = getState();
  const day = today();
  const week = weekKey(day);

  const checkIn = state.checkIns.find((c) => c.week === week);
  const availableDays = availableDaysForWeek(state, week);
  const split = splitForDays(availableDays);
  const schedule = weekSchedule(state, day);
  const doneSessions = completedSessionsThisWeek(state, day);
  const prep = state.mealPrep.find((p) => p.week === week);

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow' }, `Week ${week.split('-W')[1]}`),
        el('h1', {}, SPLIT_LABELS[split]),
      ),
      badge(`${doneSessions}/${availableDays}`, 'accent'),
    ),

    checkIn
      ? card(
          'flat',
          el(
            'div',
            { class: 'row-between' },
            el(
              'div',
              { class: 'grow' },
              el('p', { class: 'eyebrow' }, 'Check-in gedaan'),
              el(
                'p',
                { class: 'muted' },
                `${availableDays} dagen haalbaar · energie ${checkIn.energy}/5`,
              ),
              when(!!checkIn.adjust, () => el('p', { class: 'faint' }, `"${checkIn.adjust}"`)),
            ),
            button('Wijzig', {
              variant: 'sm ghost',
              onclick: () => openCheckInSheet(week, availableDays),
            }),
          ),
        )
      : card(
          'calm',
          el('h3', {}, 'Weekcheck-in'),
          el('p', { class: 'muted' }, 'Drie vragen. Daarna weet de app welk schema deze week past.'),
          button('Beginnen', {
            variant: 'primary lg block',
            onclick: () => openCheckInSheet(week, availableDays),
          }),
        ),

    card(
      null,
      el('p', { class: 'eyebrow' }, 'Je week'),
      el(
        'div',
        { class: 'list' },
        ...schedule.map((d) => {
          const finished =
            d.session?.status === 'voltooid' || d.session?.status === 'minimaal';
          return el(
            'div',
            { class: 'list-item' },
            el(
              'span',
              {
                class: 'faint',
                style: {
                  width: '26px',
                  fontWeight: '700',
                  color: d.day === day ? 'var(--accent)' : '',
                },
              },
              DAY_NAMES[d.weekday - 1],
            ),
            el(
              'span',
              { class: 'grow' },
              el('span', { class: 'title' }, d.template ? d.template.name : 'Rust'),
              when(d.isTeachingDay, () =>
                el('span', { class: 'faint' }, `Lesdag · voorkeur ${d.preferredTime}`),
              ),
            ),
            when(finished, () => check(true)),
          );
        }),
      ),
    ),

    /* Meal prep: basisformule + boodschappenlijst (§3B). */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Meal prep'),
        when(!!prep?.cookedAt, () => badge('Gekookt', 'accent')),
      ),
      ...(prep && prep.items.length > 0
        ? [
            el(
              'div',
              { class: 'list' },
              ...prep.items.map((item) =>
                el(
                  'button',
                  {
                    class: 'list-item',
                    onclick: () =>
                      update((s) => {
                        s.mealPrep = s.mealPrep.map((p) =>
                          p.week === week
                            ? {
                                ...p,
                                items: p.items.map((x) =>
                                  x.id === item.id ? { ...x, done: !x.done } : x,
                                ),
                              }
                            : p,
                        );
                      }),
                  },
                  check(item.done),
                  el(
                    'span',
                    { class: 'grow' },
                    el('span', { class: 'title' }, `${item.emergency ? '🆘 ' : ''}${item.name}`),
                    el(
                      'span',
                      { class: 'faint' },
                      `${componentLabel(item.component)} · ${item.portions} porties`,
                    ),
                  ),
                ),
              ),
            ),
            el(
              'div',
              { class: 'row' },
              button('Aanpassen', {
                variant: 'ghost grow',
                onclick: () => openPrepPlanner(week),
              }),
              button('Gekookt', {
                variant: 'primary grow',
                onclick: () => {
                  update((s) => {
                    s.mealPrep = s.mealPrep.map((p) =>
                      p.week === week ? { ...p, cookedAt: nowISO() } : p,
                    );
                  });
                  tapFeedback(state.settings.celebrate);
                  toast('Ik ben iemand die zijn week voorbereidt.', true);
                },
              }),
            ),
          ]
        : [
            el(
              'p',
              { class: 'muted' },
              'Eiwitbron + koolhydraatbron + groente + smaakmaker. Eén keer koken, de rest van de week beslist je niets meer.',
            ),
            button('Prep plannen', {
              variant: 'primary lg block',
              onclick: () => openPrepPlanner(week),
            }),
          ]),
    ),

    when(!!prep && prep.items.length > 0, () => shoppingList(week)),

    card(
      null,
      el(
        'div',
        { class: 'row-between' },
        el(
          'div',
          { class: 'grow' },
          el('p', { class: 'eyebrow' }, 'Lichaamsmeting'),
          el('p', { class: 'muted' }, 'Eén keer per week, vaste dag.'),
        ),
        button('Openen', { onclick: () => go('lichaam') }),
      ),
    ),
  );
}

/** Opent de check-in direct — gebruikt vanaf het Vandaag-scherm. */
export function maybeOpenCheckIn() {
  const state = getState();
  if (needsCheckIn(state)) {
    const week = weekKey(today());
    openCheckInSheet(week, availableDaysForWeek(state, week));
  }
}
