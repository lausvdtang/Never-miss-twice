import { el, when } from '../dom.js';
import { HABIT_FORMATION, INTENTION_TEMPLATES } from '../presets.js';
import { DAY_NAMES, plural } from '../date.js';
import { today } from '../date.js';
import { completionMessage } from '../habits.js';
import { habitStates } from '../selectors.js';
import { getState, newId, nowISO, update } from '../store.js';
import {
  badge,
  button,
  card,
  cardTitle,
  check,
  chip,
  closeSheet,
  field,
  openSheet,
  refreshSheet,
  streakStrip,
  tapFeedback,
  toast,
} from '../ui.js';

function openHabitEditor(habit) {
  const draft = { ...habit, activeDays: [...habit.activeDays] };

  openSheet({
    title: draft.name,
    render: () =>
      el(
        'div',
        { class: 'stack' },
        field(
          'Identiteit — "Ik ben iemand die…"',
          el('input', {
            class: 'input',
            value: draft.identity,
            oninput: (e) => {
              draft.identity = e.target.value;
            },
          }),
        ),
        field(
          'Anker — waar plak je het aan vast?',
          el('input', {
            class: 'input',
            value: draft.anchor,
            placeholder: 'Bijv. na het avondeten',
            oninput: (e) => {
              draft.anchor = e.target.value;
            },
          }),
          el(
            'p',
            { class: 'faint' },
            'Een gewoonte aan een bestaand moment koppelen werkt beter dan een tijdstip prikken.',
          ),
        ),
        field(
          'Minimale versie — wat telt op een slechte dag?',
          el('input', {
            class: 'input',
            value: draft.minimalVersion,
            oninput: (e) => {
              draft.minimalVersion = e.target.value;
            },
          }),
        ),
        field(
          'Op welke dagen telt dit?',
          el(
            'div',
            { class: 'row wrap' },
            ...DAY_NAMES.map((name, i) => {
              const wd = i + 1;
              const on = draft.activeDays.length === 0 || draft.activeDays.includes(wd);
              return chip(name, {
                on,
                onclick: () => {
                  const current =
                    draft.activeDays.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : draft.activeDays;
                  const next = current.includes(wd)
                    ? current.filter((d) => d !== wd)
                    : [...current, wd].sort();
                  draft.activeDays = next.length === 7 ? [] : next;
                  refreshSheet();
                },
              });
            }),
          ),
        ),
        button('Opslaan', {
          variant: 'primary lg block',
          onclick: () => {
            update((s) => {
              s.habits = s.habits.map((h) => (h.id === draft.id ? { ...draft } : h));
            });
            closeSheet();
            toast('Opgeslagen');
          },
        }),
        button('Gewoonte archiveren', {
          variant: 'quiet block',
          onclick: () => {
            update((s) => {
              s.habits = s.habits.map((h) =>
                h.id === draft.id ? { ...h, archived: true } : h,
              );
            });
            closeSheet();
            toast('Gewoonte gearchiveerd');
          },
        }),
      ),
  });
}

function openNewHabitSheet() {
  const draft = { identity: '', name: '', anchor: '', minimal: '' };

  openSheet({
    title: 'Nieuwe gewoonte',
    render: () => {
      const submit = button('Toevoegen', {
        variant: 'primary lg block',
        disabled: true,
        onclick: () => {
          if (!draft.name.trim()) return;
          update((s) => {
            s.habits = [
              ...s.habits,
              {
                id: newId('hab'),
                identity:
                  draft.identity.trim() ||
                  `Ik ben iemand die ${draft.name.trim().toLowerCase()} doet`,
                name: draft.name.trim(),
                anchor: draft.anchor.trim(),
                minimalVersion: draft.minimal.trim() || 'De kleinst mogelijke versie telt.',
                activeDays: [],
                icon: '✅',
                archived: false,
                createdAt: nowISO(),
                autoSource: null,
              },
            ];
          });
          closeSheet();
          toast('Gewoonte toegevoegd', true);
        },
      });

      const textField = (label, key, placeholder, isName = false) =>
        field(
          label,
          el('input', {
            class: 'input',
            value: draft[key],
            placeholder,
            oninput: (e) => {
              draft[key] = e.target.value;
              // Alleen de knop bijwerken: hertekenen zou de focus wegnemen.
              if (isName) submit.disabled = !draft.name.trim();
            },
          }),
        );

      return el(
        'div',
        { class: 'stack' },
        textField('Naam', 'name', 'Bijv. Water bij het ontbijt', true),
        textField('Ik ben iemand die…', 'identity', 'Ik ben iemand die goed voor zichzelf zorgt'),
        textField('Anker — na welk bestaand moment?', 'anchor', 'Na het tandenpoetsen'),
        textField('Minimale versie', 'minimal', 'Eén slok telt'),
        submit,
      );
    },
  });
}

function openIntentionSheet() {
  const draft = { trigger: '', action: '' };

  openSheet({
    title: 'Als-dan-regel',
    render: () => {
      const triggerInput = el('input', {
        class: 'input',
        value: draft.trigger,
        placeholder: 'Als het regent',
        oninput: (e) => {
          draft.trigger = e.target.value;
        },
      });
      const actionInput = el('input', {
        class: 'input',
        value: draft.action,
        placeholder: 'dan doe ik 15 min bodyweight thuis',
        oninput: (e) => {
          draft.action = e.target.value;
        },
      });

      return el(
        'div',
        { class: 'stack' },
        el(
          'p',
          { class: 'muted' },
          'Kies een voorbeeld of schrijf je eigen regel. Concreet werkt beter dan algemeen.',
        ),
        el(
          'div',
          { class: 'stack-sm' },
          ...INTENTION_TEMPLATES.map((t) =>
            el(
              'button',
              {
                class: 'btn block intention-btn',
                onclick: () => {
                  draft.trigger = t.trigger;
                  draft.action = t.action;
                  refreshSheet();
                },
              },
              el(
                'span',
                {},
                el('span', { class: 'title' }, t.trigger),
                el('span', { class: 'faint' }, t.action),
              ),
            ),
          ),
        ),
        el('div', { class: 'divider' }),
        field('Als…', triggerInput),
        field('Dan…', actionInput),
        button('Opslaan', {
          variant: 'primary lg block',
          onclick: () => {
            if (!draft.trigger.trim() || !draft.action.trim()) {
              toast('Vul allebei de helften even in.');
              return;
            }
            update((s) => {
              s.intentions = [
                ...s.intentions,
                {
                  id: newId('int'),
                  trigger: draft.trigger.trim(),
                  action: draft.action.trim(),
                  timesUsed: 0,
                  createdAt: nowISO(),
                },
              ];
            });
            closeSheet();
            toast('Regel opgeslagen', true);
          },
        }),
      );
    },
  });
}

export function renderHabits() {
  const state = getState();
  const day = today();
  const states = habitStates(state, day);

  function toggle(habitId, minimal) {
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

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow' }, 'Gewoontes'),
        el('h1', {}, 'Wie je bent, elke dag'),
      ),
      button('+', {
        variant: 'icon ghost',
        ariaLabel: 'Gewoonte toevoegen',
        onclick: openNewHabitSheet,
      }),
    ),

    ...states.map((s) =>
      card(
        null,
        cardTitle(
          el(
            'div',
            { class: 'grow' },
            el('h3', {}, `${s.habit.icon} ${s.habit.name}`),
            el('p', { class: 'faint' }, s.habit.identity),
          ),
          when(s.streak > 0, () => badge(plural(s.streak, 'dag', 'dagen'), 'accent')),
        ),

        streakStrip(s.recent),

        el(
          'div',
          { class: 'row-between' },
          el(
            'span',
            { class: 'faint' },
            `${s.last30}× in de laatste 30 dagen${
              s.bestStreak > s.streak ? ` · beste ${s.bestStreak}` : ''
            }`,
          ),
          when(!!s.habit.autoSource, () => badge('automatisch', 'calm')),
        ),

        /* Never miss twice: mild bij één misser, actief bij twee. */
        when(s.status === 'een_gemist' && !s.doneToday, () =>
          el(
            'p',
            { class: 'muted' },
            'Gisteren overgeslagen. Eén dag verandert niets aan je gewoonte — vandaag gewoon weer.',
          ),
        ),
        when(s.status === 'herstel' && !s.doneToday, () =>
          card(
            'attention',
            el(
              'p',
              { class: 'muted' },
              `Twee dagen op rij overgeslagen. Doe vandaag de kleinste versie: ${s.habit.minimalVersion}`,
            ),
          ),
        ),

        s.activeToday
          ? el(
              'div',
              { class: 'row' },
              el(
                'button',
                {
                  class: `btn ${s.doneToday ? 'ghost' : 'primary'} grow`,
                  disabled: !!s.habit.autoSource && s.doneToday,
                  onclick: () => toggle(s.habit.id, false),
                },
                check(s.doneToday),
                s.doneToday ? 'Gedaan' : 'Afvinken',
              ),
              when(!s.doneToday, () =>
                button('Minimale versie', {
                  variant: 'ghost',
                  onclick: () => toggle(s.habit.id, true),
                }),
              ),
            )
          : el('p', { class: 'faint' }, 'Vandaag niet ingepland voor deze gewoonte.'),

        button('Anker en instellingen', {
          variant: 'quiet sm',
          onclick: () => openHabitEditor(s.habit),
        }),
      ),
    ),

    /* Implementation intentions (§3D). */
    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Als-dan-regels'),
        button('+ Nieuw', { variant: 'quiet sm', onclick: openIntentionSheet }),
      ),
      el(
        'p',
        { class: 'muted' },
        'Vooraf bedacht, zodat je in het moment niet hoeft na te denken.',
      ),
      state.intentions.length === 0
        ? el(
            'p',
            { class: 'empty' },
            'Nog geen regels. Eén goede regel voor je meest voorspelbare obstakel is genoeg om te beginnen.',
          )
        : el(
            'div',
            { class: 'list' },
            ...state.intentions.map((i) =>
              el(
                'div',
                { class: 'list-item' },
                el(
                  'span',
                  { class: 'grow' },
                  el('span', { class: 'title' }, i.trigger),
                  el('span', { class: 'faint' }, `→ ${i.action}`),
                ),
                button('✕', {
                  variant: 'quiet sm',
                  ariaLabel: 'Regel verwijderen',
                  onclick: () =>
                    update((s) => {
                      s.intentions = s.intentions.filter((x) => x.id !== i.id);
                    }),
                }),
              ),
            ),
          ),
    ),

    card(
      'flat',
      el(
        'p',
        { class: 'muted' },
        `Een gewoonte voelt gemiddeld na zo'n ${HABIT_FORMATION.averageDays} dagen automatisch — met een spreiding van ${HABIT_FORMATION.rangeLow} tot ${HABIT_FORMATION.rangeHigh} dagen. Met ADHD duurt het vaak wat langer, richting ${HABIT_FORMATION.adhdMonthsLow}-${HABIT_FORMATION.adhdMonthsHigh} maanden. Dat is geen falen, dat is gewoon de spreiding.`,
      ),
    ),
  );
}
