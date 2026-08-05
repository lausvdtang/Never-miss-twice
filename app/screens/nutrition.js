import { el, when } from '../dom.js';
import { ALCOHOL_PRESETS, NOT_RECOMMENDED } from '../presets.js';
import { formatDayShort, nl, today, weekDays } from '../date.js';
import { go } from '../nav.js';
import { PHASE_LABELS, eightyTwenty, macroTargets, proteinPerMeal } from '../nutrition.js';
import {
  alcoholOn,
  dailyTotals,
  mealsOn,
  weekAlcohol,
  weekMeals,
} from '../selectors.js';
import { getState, update } from '../store.js';
import { hoursSinceLastSession } from '../training.js';
import {
  badge,
  bar,
  button,
  card,
  cardTitle,
  chip,
  macroRow,
  openSheet,
  refreshSheet,
  ring,
  splitBar,
  toast,
} from '../ui.js';
import { openAlcoholSheet, openFoodSheet } from './sheets.js';

function openSupplementSheet() {
  openSheet({
    title: 'Supplementen',
    render: () =>
      el(
        'div',
        { class: 'stack' },
        ...getState()
          .supplements.slice()
          .sort((a, b) => a.priority - b.priority)
          .map((s) =>
            card(
              'flat',
              el(
                'div',
                { class: 'row-between' },
                el(
                  'div',
                  { class: 'grow' },
                  el('h3', {}, s.name),
                  el('p', { class: 'faint' }, s.dose),
                ),
                chip(s.enabled ? 'Aan' : 'Uit', {
                  on: s.enabled,
                  onclick: () => {
                    update((st) => {
                      st.supplements = st.supplements.map((x) =>
                        x.key === s.key ? { ...x, enabled: !x.enabled } : x,
                      );
                    });
                    refreshSheet();
                  },
                }),
              ),
              when(!!s.hint, () => el('p', { class: 'muted' }, s.hint)),
            ),
          ),
        card(
          'flat',
          el('h3', {}, 'Niet nodig'),
          el(
            'p',
            { class: 'muted' },
            `${NOT_RECOMMENDED.join(', ')} — geen bewezen meerwaarde. Die staan er bewust niet in.`,
          ),
        ),
      ),
  });
}

export function renderNutrition() {
  const state = getState();
  const day = today();

  const targets = macroTargets(state.profile);
  const totals = dailyTotals(state, day);
  const meals = mealsOn(state, day);
  const drinks = alcoholOn(state, day);
  const balance = eightyTwenty(
    weekMeals(state, day),
    weekAlcohol(state, day),
    targets.kcal * 7,
  );
  const perMeal = proteinPerMeal(targets.proteinG);
  const kcalLeft = targets.kcal - totals.kcal;

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow' }, `Voeding · ${PHASE_LABELS[state.profile.phase]}`),
        el('h1', {}, `${Math.max(0, Math.round(kcalLeft))} kcal te gaan`),
      ),
      button('⚙︎', {
        variant: 'icon ghost',
        ariaLabel: 'Doelen aanpassen',
        onclick: () => go('instellingen'),
      }),
    ),

    card(
      null,
      el(
        'div',
        { class: 'ring-wrap' },
        ring({
          value: totals.kcal,
          max: targets.kcal,
          size: 104,
          label: String(Math.round(totals.kcal)),
          unit: `van ${targets.kcal}`,
        }),
        el(
          'div',
          { class: 'grow stack-sm' },
          macroRow({ name: 'Eiwit', value: totals.proteinG, target: targets.proteinG }),
          macroRow({
            name: 'Koolh.',
            value: totals.carbsG,
            target: targets.carbsG,
            color: 'var(--calm)',
          }),
          macroRow({
            name: 'Vet',
            value: totals.fatG,
            target: targets.fatG,
            color: 'var(--free)',
          }),
        ),
      ),
      el(
        'p',
        { class: 'faint' },
        `Mik op ${perMeal.meals} maaltijden van ongeveer ${perMeal.perMeal} g eiwit.`,
      ),
      el(
        'div',
        { class: 'grid-2' },
        button('+ Eten', { variant: 'primary lg', onclick: () => openFoodSheet(day) }),
        button('+ Drinken', {
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

    /* 80/20 als weekbalans, niet als dagelijks stoplicht (§8.3). */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, '80/20 deze week'),
        badge(`${balance.basePct}% basis`, balance.onTrack ? 'accent' : 'free'),
      ),
      splitBar(
        balance.totalKcal ? (balance.baseKcal / balance.totalKcal) * 100 : 100,
        balance.totalKcal ? (balance.freeKcal / balance.totalKcal) * 100 : 0,
      ),
      el(
        'div',
        { class: 'row-between' },
        el('span', { class: 'faint' }, `Vrij besteed: ${balance.freeKcal.toLocaleString('nl-NL')} kcal`),
        el('span', { class: 'faint' }, `Budget: ${balance.freeBudget.toLocaleString('nl-NL')} kcal`),
      ),
      el(
        'p',
        { class: 'muted' },
        balance.freeRemaining >= 0
          ? `Nog ${balance.freeRemaining.toLocaleString('nl-NL')} kcal vrij te besteden deze week. Snacks en bier vallen hieronder — geen verboden producten, alleen een budget.`
          : `Je zit ${Math.abs(balance.freeRemaining).toLocaleString('nl-NL')} kcal boven je vrije budget. Volgende week schuift dat vanzelf weer terug — dit is een weekbalans, geen cijfer per dag.`,
      ),
    ),

    /* Vandaag gelogd, met snelle verwijderoptie. */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Vandaag gelogd'),
        el('span', { class: 'faint' }, `${meals.length + drinks.length} items`),
      ),
      meals.length === 0 && drinks.length === 0
        ? el('p', { class: 'empty' }, 'Nog niets gelogd vandaag.')
        : el(
            'div',
            { class: 'list' },
            ...meals.map((m) =>
              el(
                'div',
                { class: 'list-item' },
                el(
                  'span',
                  { class: 'grow' },
                  el(
                    'span',
                    { class: 'title' },
                    `${m.name}${m.servings !== 1 ? ` ×${String(m.servings).replace('.', ',')}` : ''}`,
                  ),
                  el(
                    'span',
                    { class: 'faint' },
                    `${Math.round(m.kcal * m.servings)} kcal · ${Math.round(
                      m.proteinG * m.servings,
                    )} g eiwit`,
                  ),
                ),
                when(m.quality === 'vrij', () => badge('20%', 'free')),
                button('✕', {
                  variant: 'quiet sm',
                  ariaLabel: `${m.name} verwijderen`,
                  onclick: () => {
                    update((s) => {
                      s.meals = s.meals.filter((x) => x.id !== m.id);
                    });
                    toast('Verwijderd');
                  },
                }),
              ),
            ),
            ...drinks.map((a) =>
              el(
                'div',
                { class: 'list-item' },
                el(
                  'span',
                  { class: 'grow' },
                  el('span', { class: 'title' }, `${a.name}${a.count > 1 ? ` ×${a.count}` : ''}`),
                  el(
                    'span',
                    { class: 'faint' },
                    `${Math.round(a.kcal * a.count)} kcal · ${nl(
                      a.standardGlasses * a.count,
                    )} standaardglazen`,
                  ),
                ),
                badge('20%', 'free'),
                button('✕', {
                  variant: 'quiet sm',
                  ariaLabel: `${a.name} verwijderen`,
                  onclick: () => {
                    update((s) => {
                      s.alcohol = s.alcohol.filter((x) => x.id !== a.id);
                    });
                    toast('Verwijderd');
                  },
                }),
              ),
            ),
          ),
    ),

    /* Weekoverzicht per dag: puur informatief, zonder oordeel. */
    card(
      null,
      el('p', { class: 'eyebrow' }, 'Deze week'),
      el(
        'div',
        { class: 'list' },
        ...weekDays(day).map((d) => {
          const t = dailyTotals(state, d);
          const isFuture = d > day;
          return el(
            'div',
            { class: 'list-item' },
            el('span', { class: 'faint', style: { width: '58px' } }, formatDayShort(d)),
            el(
              'span',
              { class: 'grow' },
              bar({
                value: t.kcal,
                max: targets.kcal,
                color: isFuture ? 'var(--surface-3)' : 'var(--accent)',
              }),
            ),
            el(
              'span',
              { class: 'faint', style: { minWidth: '52px', textAlign: 'right' } },
              t.kcal > 0 ? String(Math.round(t.kcal)) : '—',
            ),
          );
        }),
      ),
    ),

    card(
      null,
      el(
        'div',
        { class: 'row-between' },
        el(
          'div',
          { class: 'grow' },
          el('p', { class: 'eyebrow' }, 'Meal prep'),
          el('p', { class: 'muted' }, 'Batch koken en je boodschappenlijst.'),
        ),
        button('Openen', { onclick: () => go('week') }),
      ),
    ),

    button('Over supplementen', { variant: 'quiet block', onclick: openSupplementSheet }),
  );
}
