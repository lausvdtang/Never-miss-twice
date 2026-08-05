import { clear, el } from '../dom.js';
import { ALCOHOL_RECOVERY_WINDOW_HOURS } from '../presets.js';
import { newId, nowISO, getState, update } from '../store.js';
import { nl } from '../date.js';
import {
  badge,
  button,
  card,
  chip,
  closeSheet,
  field,
  openSheet,
  refreshSheet,
  stepper,
  tapFeedback,
  toast,
} from '../ui.js';

/**
 * Eten loggen in maximaal drie taps: openen → product → toevoegen.
 * Favorieten en noodmaaltijden staan bovenaan, want die zijn het vaakst nodig.
 */
export function openFoodSheet(day) {
  let selected = null;
  let servings = 1;
  let custom = false;
  let query = '';
  const draft = {
    name: '',
    kcal: 400,
    proteinG: 30,
    carbsG: 40,
    fatG: 12,
    quality: 'basis',
  };

  function matches() {
    const q = query.trim().toLowerCase();
    const list = getState().foodPresets;
    if (!q) {
      return [...list].sort((a, b) => {
        const score = (f) => (f.favorite ? 0 : 1) + (f.emergency ? -0.5 : 0);
        return score(a) - score(b) || a.name.localeCompare(b.name);
      });
    }
    return list.filter((f) => f.name.toLowerCase().includes(q));
  }

  function addPreset(preset, count) {
    update((s) => {
      s.meals = [
        ...s.meals,
        {
          id: newId('meal'),
          day,
          name: preset.name,
          kcal: preset.kcal,
          proteinG: preset.proteinG,
          carbsG: preset.carbsG,
          fatG: preset.fatG,
          quality: preset.quality,
          servings: count,
          presetId: preset.id,
          loggedAt: nowISO(),
        },
      ];
    });
    tapFeedback(getState().settings.celebrate);
    toast(`${preset.name} toegevoegd`, true);
    closeSheet();
  }

  function addCustom() {
    if (!draft.name.trim()) return;
    update((s) => {
      s.meals = [
        ...s.meals,
        {
          id: newId('meal'),
          day,
          name: draft.name.trim(),
          kcal: draft.kcal,
          proteinG: draft.proteinG,
          carbsG: draft.carbsG,
          fatG: draft.fatG,
          quality: draft.quality,
          servings: 1,
          loggedAt: nowISO(),
        },
      ];
      // Meteen bewaren als preset, zodat het de volgende keer één tap is.
      s.foodPresets = [
        ...s.foodPresets,
        {
          id: newId('fp'),
          name: draft.name.trim(),
          portion: '1 portie',
          kcal: draft.kcal,
          proteinG: draft.proteinG,
          carbsG: draft.carbsG,
          fatG: draft.fatG,
          quality: draft.quality,
        },
      ];
    });
    tapFeedback(getState().settings.celebrate);
    toast(`${draft.name.trim()} toegevoegd en bewaard`, true);
    closeSheet();
  }

  function renderList(container) {
    clear(container);
    const results = matches().slice(0, 40);
    if (results.length === 0) {
      container.appendChild(
        el(
          'p',
          { class: 'empty' },
          'Niets gevonden. Vul het zelf even in — daarna staat het in je lijst.',
        ),
      );
      return;
    }
    for (const f of results) {
      container.appendChild(
        el(
          'button',
          {
            class: 'list-item',
            onclick: () => {
              selected = f;
              servings = 1;
              refreshSheet();
            },
          },
          el(
            'span',
            { class: 'grow' },
            el('span', { class: 'title' }, `${f.emergency ? '🆘 ' : ''}${f.name}`),
            el('span', { class: 'faint' }, `${f.portion} · ${f.kcal} kcal · ${f.proteinG} g eiwit`),
          ),
          f.quality === 'vrij' ? badge('20%', 'free') : null,
        ),
      );
    }
  }

  openSheet({
    get title() {
      return selected ? selected.name : custom ? 'Zelf invullen' : 'Wat heb je gegeten?';
    },
    render() {
      /* Stap 2: portie kiezen. Standaard 1 — direct toevoegen kan altijd. */
      if (selected) {
        return el(
          'div',
          { class: 'stack' },
          card(
            'flat',
            el(
              'div',
              { class: 'row-between' },
              el(
                'div',
                {},
                el('h3', {}, selected.name),
                el('p', { class: 'faint' }, selected.portion),
              ),
              badge(selected.quality === 'basis' ? '80%' : '20%', selected.quality === 'basis' ? 'accent' : 'free'),
            ),
            el(
              'div',
              { class: 'row-between' },
              el('span', { class: 'muted' }, 'Aantal porties'),
              stepper({
                value: servings,
                onChange: (v) => {
                  servings = v;
                  refreshSheet();
                },
                step: 0.5,
                min: 0.5,
                max: 10,
                format: (v) => (Number.isInteger(v) ? String(v) : nl(v)),
                label: 'Porties',
              }),
            ),
            el('div', { class: 'divider' }),
            el(
              'div',
              { class: 'row-between faint' },
              el('span', {}, `${Math.round(selected.kcal * servings)} kcal`),
              el('span', {}, `${Math.round(selected.proteinG * servings)} g eiwit`),
              el('span', {}, `${Math.round(selected.carbsG * servings)} g kh`),
              el('span', {}, `${Math.round(selected.fatG * servings)} g vet`),
            ),
          ),
          button('Toevoegen', {
            variant: 'primary lg block',
            onclick: () => addPreset(selected, servings),
          }),
          button('Ander product', {
            variant: 'quiet block',
            onclick: () => {
              selected = null;
              refreshSheet();
            },
          }),
        );
      }

      /* Zelf invullen: alles met steppers, alleen de naam is tekst. */
      if (custom) {
        const submit = button('Toevoegen en bewaren', {
          variant: 'primary lg block',
          onclick: addCustom,
          disabled: true,
        });

        const nameInput = el('input', {
          class: 'input',
          value: draft.name,
          placeholder: 'Bijv. broodje van de kantine',
          oninput: (e) => {
            // Bewust géén volledige hertekening: dan verlies je de focus
            // midden in het typen. Alleen de knop bijwerken.
            draft.name = e.target.value;
            submit.disabled = !draft.name.trim();
          },
        });

        const numberField = (label, key, step, max) =>
          field(
            label,
            stepper({
              value: draft[key],
              onChange: (v) => {
                draft[key] = v;
                refreshSheet();
              },
              step,
              max,
              label,
            }),
          );

        return el(
          'div',
          { class: 'stack' },
          field('Naam', nameInput),
          el(
            'div',
            { class: 'grid-2' },
            numberField('Kcal', 'kcal', 25, 3000),
            numberField('Eiwit (g)', 'proteinG', 5, 200),
            numberField('Koolhydraten (g)', 'carbsG', 5, 400),
            numberField('Vet (g)', 'fatG', 5, 200),
          ),
          field(
            'Telt mee als',
            el(
              'div',
              { class: 'row' },
              chip('Basis (de 80%)', {
                on: draft.quality === 'basis',
                onclick: () => {
                  draft.quality = 'basis';
                  refreshSheet();
                },
              }),
              chip('Vrij (de 20%)', {
                free: true,
                on: draft.quality === 'vrij',
                onclick: () => {
                  draft.quality = 'vrij';
                  refreshSheet();
                },
              }),
            ),
          ),
          submit,
          button('Terug naar de lijst', {
            variant: 'quiet block',
            onclick: () => {
              custom = false;
              refreshSheet();
            },
          }),
        );
      }

      /* Stap 1: kiezen uit de lijst, met zoeken zonder focusverlies. */
      const listEl = el('div', { class: 'list' });
      renderList(listEl);

      const search = el('input', {
        class: 'input',
        value: query,
        placeholder: 'Zoeken…',
        'aria-label': 'Zoek een product',
        oninput: (e) => {
          query = e.target.value;
          renderList(listEl);
        },
      });

      return el(
        'div',
        { class: 'stack' },
        search,
        listEl,
        button('Zelf invullen', {
          variant: 'ghost block',
          onclick: () => {
            custom = true;
            refreshSheet();
          },
        }),
      );
    },
  });
}

/**
 * Alcohol loggen zonder oordeel. De presets komen uit de kennisbasis (§8.4),
 * zodat er nooit handmatig kcal ingetypt hoeft te worden.
 */
export function openAlcoholSheet(day, presets, hoursSinceTraining, showRecoveryHint) {
  let chosen = null;
  let count = 1;

  const recentTraining =
    hoursSinceTraining !== null && hoursSinceTraining < ALCOHOL_RECOVERY_WINDOW_HOURS;

  function log(preset, howMany) {
    update((s) => {
      s.alcohol = [
        ...s.alcohol,
        {
          id: newId('alc'),
          day,
          name: preset.name,
          kcal: preset.kcal,
          standardGlasses: preset.standardGlasses,
          count: howMany,
          presetId: preset.id,
          loggedAt: nowISO(),
          withinHoursOfTraining:
            hoursSinceTraining !== null ? Math.round(hoursSinceTraining * 10) / 10 : null,
        },
      ];
    });
    tapFeedback(getState().settings.celebrate);
    toast('Genoteerd — verrekend in je dagbudget.');
    closeSheet();
  }

  openSheet({
    title: 'Wat drink je?',
    render() {
      const hint =
        showRecoveryHint && recentTraining
          ? card(
              'calm',
              el(
                'p',
                { class: 'muted' },
                `Je trainde ${Math.round(hoursSinceTraining)} uur geleden. Herstel en eiwitsynthese profiteren van een paar uur ertussen — verder geen probleem.`,
              ),
            )
          : null;

      if (chosen) {
        return el(
          'div',
          { class: 'stack' },
          hint,
          card(
            'flat',
            el(
              'div',
              {},
              el('h3', {}, chosen.name),
              el(
                'p',
                { class: 'faint' },
                `${chosen.volumeMl} ml · ${chosen.kcal} kcal · ${nl(chosen.standardGlasses)} standaardglas${chosen.standardGlasses === 1 ? '' : 'sen'}`,
              ),
            ),
            el(
              'div',
              { class: 'row-between' },
              el('span', { class: 'muted' }, 'Aantal'),
              stepper({
                value: count,
                onChange: (v) => {
                  count = v;
                  refreshSheet();
                },
                min: 1,
                max: 20,
                label: 'Aantal',
              }),
            ),
            el('div', { class: 'divider' }),
            el(
              'p',
              { class: 'faint' },
              `Totaal ${chosen.kcal * count} kcal — gaat automatisch van je dagbudget af.`,
            ),
          ),
          button('Loggen', {
            variant: 'primary lg block',
            onclick: () => log(chosen, count),
          }),
          button('Iets anders', {
            variant: 'quiet block',
            onclick: () => {
              chosen = null;
              refreshSheet();
            },
          }),
        );
      }

      return el(
        'div',
        { class: 'stack' },
        hint,
        el(
          'div',
          { class: 'stack-sm' },
          // Eén tap = één glas. Meer? Dan pas het aantal-scherm.
          ...presets.map((p) =>
            el(
              'button',
              { class: 'btn lg block split', onclick: () => log(p, 1) },
              el('span', {}, p.name),
              el('span', { class: 'faint' }, `${p.kcal} kcal`),
            ),
          ),
        ),
        button('Meerdere tegelijk loggen', {
          variant: 'ghost block',
          onclick: () => {
            chosen = presets[0];
            refreshSheet();
          },
        }),
        el(
          'p',
          { class: 'faint center' },
          'Dit is een budget, geen oordeel. Alcohol telt mee in je 20%.',
        ),
      );
    },
  });
}
