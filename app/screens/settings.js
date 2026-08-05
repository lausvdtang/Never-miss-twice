import { el, when } from '../dom.js';
import { NOT_RECOMMENDED } from '../presets.js';
import { DAY_NAMES, DAY_NAMES_LONG, nl } from '../date.js';
import {
  buildCombinedCsv,
  buildCsvFiles,
  downloadText,
  exportBackup,
  openPrintableReport,
  parseBackup,
} from '../export.js';
import { go } from '../nav.js';
import {
  ACTIVITY_LABELS,
  PHASE_DESCRIPTIONS,
  PHASE_LABELS,
  estimateMaintenance,
  macroTargets,
  proteinRange,
} from '../nutrition.js';
import { getState, replaceState, resetAll, update } from '../store.js';
import {
  badge,
  button,
  card,
  cardTitle,
  chip,
  closeSheet,
  field,
  openSheet,
  segment,
  stepper,
  toast,
} from '../ui.js';

export function renderSettings() {
  const state = getState();
  const profile = state.profile;
  const targets = macroTargets(profile);
  const [proteinLow, proteinHigh] = proteinRange(profile.phase);

  const setProfile = (patch) =>
    update((s) => {
      s.profile = { ...s.profile, ...patch };
    });

  const setSettings = (patch) =>
    update((s) => {
      s.settings = { ...s.settings, ...patch };
    });

  const restoreInput = el('input', {
    type: 'file',
    accept: 'application/json',
    style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        replaceState(parseBackup(await file.text()));
        toast('Back-up teruggezet', true);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Bestand kon niet gelezen worden');
      }
    },
  });

  function openExportSheet() {
    openSheet({
      title: 'Exporteren',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          el(
            'p',
            { class: 'muted' },
            'Kies wat je wilt meenemen. Alles wordt op dit apparaat gegenereerd.',
          ),
          button('Alles als één CSV', {
            variant: 'lg block',
            onclick: () => {
              downloadText('never-miss-twice.csv', buildCombinedCsv(getState()));
              toast('CSV gedownload');
            },
          }),
          button('Losse CSV per onderdeel', {
            variant: 'lg block',
            onclick: () => {
              for (const f of buildCsvFiles(getState())) downloadText(f.name, f.content);
              toast('CSV-bestanden gedownload');
            },
          }),
          button('Overzicht als PDF (via printen)', {
            variant: 'lg block',
            onclick: () => {
              if (!openPrintableReport(getState())) {
                toast('Sta pop-ups toe om het rapport te openen');
              }
            },
          }),
          button('Volledige back-up (JSON)', {
            variant: 'lg block',
            onclick: () => {
              downloadText(
                'never-miss-twice-backup.json',
                exportBackup(getState()),
                'application/json',
              );
              toast('Back-up gedownload');
            },
          }),
        ),
    });
  }

  function openPrivacySheet() {
    openSheet({
      title: 'Privacy',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          el(
            'p',
            { class: 'muted' },
            "Je gezondheidsgegevens staan in de opslag van je eigen browser. Voortgangsfoto's staan in IndexedDB, ook lokaal. Er is geen server, geen account en geen synchronisatie — dus ook niets dat gelekt kan worden bij iemand anders.",
          ),
          el(
            'p',
            { class: 'muted' },
            'De keerzijde: als je je browserdata wist of van apparaat wisselt, is het weg. Maak af en toe een back-up via Exporteren → Volledige back-up.',
          ),
          card(
            'flat',
            el('h3', {}, 'Wat de app bewust niet doet'),
            el(
              'p',
              { class: 'muted' },
              `Geen advertenties, geen tracking, geen aanbevelingen voor ${NOT_RECOMMENDED.join(', ').toLowerCase()}.`,
            ),
          ),
          button('Duidelijk', { variant: 'ghost block', onclick: closeSheet }),
        ),
    });
  }

  function openResetSheet() {
    openSheet({
      title: 'Alles wissen',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          el(
            'p',
            { class: 'muted' },
            'Dit verwijdert al je trainingen, maaltijden, metingen en gewoontes van dit apparaat. Dit kan niet ongedaan worden gemaakt.',
          ),
          el(
            'button',
            {
              class: 'btn lg block',
              style: { background: 'var(--attention-soft)', color: 'var(--attention)' },
              onclick: () => {
                downloadText(
                  'never-miss-twice-backup.json',
                  exportBackup(getState()),
                  'application/json',
                );
                toast('Back-up gedownload — daarna pas wissen');
              },
            },
            'Eerst een back-up downloaden',
          ),
          el(
            'button',
            {
              class: 'btn lg block',
              style: { background: 'var(--attention)', color: 'var(--accent-text)' },
              onclick: () => {
                resetAll();
                closeSheet();
                toast('Alles gewist');
                go('vandaag');
              },
            },
            'Ja, alles wissen',
          ),
          button('Annuleren', { variant: 'quiet block', onclick: closeSheet }),
        ),
    });
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
        el('p', { class: 'eyebrow' }, 'Instellingen'),
        el('h1', {}, 'Jouw setup'),
      ),
      button('✕', {
        variant: 'icon ghost',
        ariaLabel: 'Sluiten',
        onclick: () => go('vandaag'),
      }),
    ),

    card(
      null,
      el('p', { class: 'eyebrow' }, 'Profiel'),
      field(
        'Naam',
        el('input', {
          class: 'input',
          value: profile.name,
          placeholder: 'Hoe mag de app je noemen?',
          // Bij blur opslaan: tijdens typen hertekenen kost de focus.
          onblur: (e) => setProfile({ name: e.target.value }),
        }),
      ),
      el(
        'div',
        { class: 'grid-2' },
        field(
          'Gewicht',
          stepper({
            value: profile.weightKg,
            onChange: (v) => setProfile({ weightKg: v }),
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
            value: profile.heightCm,
            onChange: (v) => setProfile({ heightCm: v }),
            step: 1,
            min: 130,
            max: 230,
            unit: 'cm',
            label: 'Lengte',
          }),
        ),
      ),
      field(
        'Geboortejaar',
        stepper({
          value: profile.birthYear,
          onChange: (v) => setProfile({ birthYear: v }),
          step: 1,
          min: 1930,
          max: new Date().getFullYear() - 12,
          label: 'Geboortejaar',
        }),
      ),
      field(
        'Dagelijkse activiteit (buiten trainen om)',
        el(
          'div',
          { class: 'row wrap' },
          ...Object.keys(ACTIVITY_LABELS).map((a) =>
            chip(ACTIVITY_LABELS[a], {
              on: profile.activity === a,
              onclick: () => setProfile({ activity: a }),
            }),
          ),
        ),
      ),
    ),

    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Fase'),
        badge(`${targets.kcal} kcal`, 'accent'),
      ),
      segment({
        value: profile.phase,
        ariaLabel: 'Fase',
        options: ['recomp', 'leanbulk', 'cut'].map((p) => ({ value: p, label: PHASE_LABELS[p] })),
        onChange: (v) => setProfile({ phase: v }),
      }),
      el('p', { class: 'muted' }, PHASE_DESCRIPTIONS[profile.phase]),
      el('div', { class: 'divider' }),
      el(
        'div',
        { class: 'row-between' },
        el('span', { class: 'faint' }, 'Geschat onderhoud'),
        el('span', { class: 'faint' }, `${estimateMaintenance(profile)} kcal`),
      ),
      el(
        'div',
        { class: 'row-between' },
        el('span', { class: 'faint' }, 'Eiwit · vet · koolhydraten'),
        el('span', { class: 'faint' }, `${targets.proteinG} · ${targets.fatG} · ${targets.carbsG} g`),
      ),
    ),

    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Eiwit'),
        badge(`${nl(profile.proteinPerKg)} g/kg`),
      ),
      stepper({
        value: profile.proteinPerKg,
        onChange: (v) => setProfile({ proteinPerKg: v }),
        step: 0.1,
        min: 1.2,
        max: 2.6,
        unit: 'g per kg',
        format: (v) => nl(v),
        label: 'Eiwit per kilo',
      }),
      el(
        'p',
        { class: 'muted' },
        `Aanbevolen voor jouw fase: ${nl(proteinLow)}-${nl(proteinHigh)} g/kg. Dat komt neer op ${Math.round(
          profile.proteinPerKg * profile.weightKg,
        )} g per dag.`,
      ),
    ),

    card(
      null,
      el('p', { class: 'eyebrow' }, 'Week en rooster'),
      field(
        'Lesdagen (vroege start)',
        el(
          'div',
          { class: 'row wrap' },
          ...DAY_NAMES.map((name, i) => {
            const wd = i + 1;
            const on = profile.teachingDays.includes(wd);
            return chip(name, {
              on,
              onclick: () =>
                setProfile({
                  teachingDays: on
                    ? profile.teachingDays.filter((d) => d !== wd)
                    : [...profile.teachingDays, wd].sort(),
                }),
            });
          }),
        ),
      ),
      field(
        'Trainen op lesdagen',
        segment({
          value: profile.trainingTimeTeachingDay,
          options: [
            { value: 'ochtend', label: 'Vóór werk' },
            { value: 'avond', label: 'Na werk' },
          ],
          onChange: (v) => setProfile({ trainingTimeTeachingDay: v }),
        }),
      ),
      field(
        'Trainen op overige dagen',
        segment({
          value: profile.trainingTimeOtherDay,
          options: [
            { value: 'ochtend', label: 'Ochtend' },
            { value: 'avond', label: 'Avond' },
            { value: 'flexibel', label: 'Flexibel' },
          ],
          onChange: (v) => setProfile({ trainingTimeOtherDay: v }),
        }),
      ),
      field(
        'Vaste weegdag',
        el(
          'div',
          { class: 'row wrap' },
          ...DAY_NAMES.map((name, i) =>
            chip(name, {
              on: profile.weighInDay === i + 1,
              onclick: () => setProfile({ weighInDay: i + 1 }),
            }),
          ),
        ),
        el(
          'p',
          { class: 'faint' },
          `${DAY_NAMES_LONG[profile.weighInDay - 1]}ochtend, nuchter. Eén keer per week.`,
        ),
      ),
      field(
        'Stappendoel',
        stepper({
          value: profile.stepGoal,
          onChange: (v) => setProfile({ stepGoal: v }),
          step: 500,
          min: 2000,
          max: 25000,
          unit: 'stappen',
          label: 'Stappendoel',
        }),
        el('p', { class: 'faint' }, 'Richtlijn: 8.000-10.000 per dag als basis.'),
      ),
    ),

    card(
      null,
      el('p', { class: 'eyebrow' }, 'Weergave'),
      segment({
        value: state.settings.theme,
        ariaLabel: 'Thema',
        options: [
          { value: 'system', label: 'Systeem' },
          { value: 'dark', label: 'Donker' },
          { value: 'light', label: 'Licht' },
        ],
        onChange: (v) => setSettings({ theme: v }),
      }),
      el(
        'label',
        { class: 'row-between', style: { minHeight: '48px' } },
        el('span', { class: 'muted' }, 'Trilling bij afvinken'),
        el('input', {
          type: 'checkbox',
          class: 'toggle',
          checked: state.settings.celebrate,
          onchange: (e) => setSettings({ celebrate: e.target.checked }),
        }),
      ),
      el(
        'label',
        { class: 'row-between', style: { minHeight: '48px' } },
        el('span', { class: 'muted' }, 'Hint bij alcohol kort na training'),
        el('input', {
          type: 'checkbox',
          class: 'toggle',
          checked: state.settings.alcoholRecoveryHint,
          onchange: (e) => setSettings({ alcoholRecoveryHint: e.target.checked }),
        }),
      ),
    ),

    card(
      null,
      el('p', { class: 'eyebrow' }, 'Je data'),
      el(
        'p',
        { class: 'muted' },
        'Alles staat op dit apparaat. Er is geen account en er gaat niets naar een server.',
      ),
      el(
        'div',
        { class: 'grid-2' },
        button('Exporteren', { onclick: openExportSheet }),
        button('Herstellen', { onclick: () => restoreInput.click() }),
      ),
      button('Hoe zit het met privacy?', {
        variant: 'quiet block',
        onclick: openPrivacySheet,
      }),
      restoreInput,
    ),

    button('Alles wissen', { variant: 'quiet block', onclick: openResetSheet }),

    el(
      'p',
      { class: 'faint center' },
      `Never Miss Twice · alles lokaal · versie ${state.version}`,
    ),
  );
}
