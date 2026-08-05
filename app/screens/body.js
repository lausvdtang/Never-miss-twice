import { el, svg, when } from '../dom.js';
import { BODY_FAT_TARGET } from '../presets.js';
import { DAY_NAMES_LONG, formatDayShort, nl, plural, today } from '../date.js';
import { bodyFatNote, trend, trendInsight, weighInGate } from '../body.js';
import {
  deletePhoto,
  getState,
  loadPhoto,
  newId,
  nowISO,
  savePhoto,
  update,
} from '../store.js';
import {
  badge,
  button,
  card,
  cardTitle,
  closeSheet,
  field,
  openSheet,
  refreshSheet,
  stepper,
  tapFeedback,
  toast,
} from '../ui.js';

/** Lijngrafiek met losse metingen als punten en het gemiddelde als lijn. */
function trendChart(points) {
  const width = 320;
  const height = 150;
  const pad = { top: 12, right: 8, bottom: 20, left: 30 };

  const values = points.flatMap((p) => [p.weightKg, p.average]);
  const min = Math.min(...values) - 0.6;
  const max = Math.max(...values) + 0.6;
  const span = Math.max(0.1, max - min);

  const x = (i) =>
    pad.left +
    (points.length === 1 ? 0 : (i / (points.length - 1)) * (width - pad.left - pad.right));
  const y = (v) => pad.top + (1 - (v - min) / span) * (height - pad.top - pad.bottom);

  const avgPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.average).toFixed(1)}`)
    .join(' ');

  return card(
    null,
    cardTitle(
      el('p', { class: 'eyebrow' }, 'Trend'),
      el('span', { class: 'faint' }, 'Gemiddelde over 4 metingen'),
    ),
    svg(
      'svg',
      {
        class: 'chart',
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'none',
        role: 'img',
        'aria-label': 'Gewichtstrend',
      },
      svg('line', {
        x1: pad.left,
        y1: height - pad.bottom,
        x2: width - pad.right,
        y2: height - pad.bottom,
        stroke: 'var(--border)',
      }),
      svg('text', { x: 2, y: y(max - 0.6) + 4, 'font-size': '9', fill: 'var(--text-faint)' }, nl(max - 0.6)),
      svg('text', { x: 2, y: y(min + 0.6) + 4, 'font-size': '9', fill: 'var(--text-faint)' }, nl(min + 0.6)),
      // Losse metingen: bewust klein en licht — het gaat om de lijn.
      ...points.map((p, i) =>
        svg('circle', {
          cx: x(i),
          cy: y(p.weightKg),
          r: 2.5,
          fill: 'var(--text-faint)',
          opacity: 0.55,
        }),
      ),
      svg('path', {
        d: avgPath,
        fill: 'none',
        stroke: 'var(--accent)',
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
      svg('circle', {
        cx: x(points.length - 1),
        cy: y(points[points.length - 1].average),
        r: 4,
        fill: 'var(--accent)',
      }),
    ),
    el(
      'div',
      { class: 'row-between' },
      el('span', { class: 'faint' }, formatDayShort(points[0].day)),
      el('span', { class: 'faint' }, formatDayShort(points[points.length - 1].day)),
    ),
  );
}

/** Thumbnail die de blob pas uit IndexedDB haalt zodra hij in beeld staat. */
function photoThumb(photo, onDelete) {
  const img = el('img', { alt: '' });
  const node = el(
    'button',
    {
      class: 'photo-thumb',
      'aria-label': `Foto van ${photo.day} verwijderen`,
      title: `${photo.day} — tik om te verwijderen`,
      onclick: onDelete,
    },
    img,
  );

  loadPhoto(photo.blobKey).then((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    img.src = url;
    // De URL blijft geldig zolang de thumbnail bestaat; bij het opnieuw
    // opbouwen van het scherm ruimt de browser hem op met het element.
    img.addEventListener('load', () => setTimeout(() => URL.revokeObjectURL(url), 0), {
      once: true,
    });
  });

  return node;
}

export function renderBody() {
  const state = getState();
  const day = today();

  const gate = weighInGate(state.weighIns, state.profile.weighInDay, day);
  const points = trend(state.weighIns);
  const insight = trendInsight(state.weighIns, state.profile.phase);
  const latest = points[points.length - 1];

  function openWeighInSheet() {
    let weight = state.profile.weightKg;
    let bodyFat = 18;
    let muscle = 0;

    openSheet({
      title: 'Meting invoeren',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          when(!gate.isWeighDay, () =>
            card(
              'calm',
              el(
                'p',
                { class: 'muted' },
                'Het is niet je vaste weegdag. Kan prima — houd het alleen consequent, anders vergelijk je appels met peren.',
              ),
            ),
          ),
          field(
            'Gewicht',
            stepper({
              value: weight,
              onChange: (v) => {
                weight = v;
                refreshSheet();
              },
              step: 0.1,
              min: 30,
              max: 250,
              unit: 'kg',
              format: (v) => nl(v),
              label: 'Gewicht',
            }),
          ),
          field(
            'Vetpercentage (optioneel, van de BIA-weegschaal)',
            stepper({
              value: bodyFat,
              onChange: (v) => {
                bodyFat = v;
                refreshSheet();
              },
              step: 0.1,
              min: 0,
              max: 60,
              unit: '%',
              format: (v) => (v === 0 ? '—' : nl(v)),
              label: 'Vetpercentage',
            }),
          ),
          field(
            'Spiermassa (optioneel)',
            stepper({
              value: muscle,
              onChange: (v) => {
                muscle = v;
                refreshSheet();
              },
              step: 0.1,
              min: 0,
              max: 120,
              unit: 'kg',
              format: (v) => (v === 0 ? '—' : nl(v)),
              label: 'Spiermassa',
            }),
          ),
          button('Opslaan', {
            variant: 'primary lg block',
            onclick: () => {
              update((s) => {
                s.weighIns = [
                  ...s.weighIns,
                  {
                    id: newId('weigh'),
                    day,
                    weightKg: weight,
                    bodyFatPct: bodyFat > 0 ? bodyFat : undefined,
                    muscleMassKg: muscle > 0 ? muscle : undefined,
                    loggedAt: nowISO(),
                  },
                ];
                // Het profielgewicht volgt de meting, zodat macro's meebewegen.
                s.profile = { ...s.profile, weightKg: weight };
              });
              closeSheet();
              tapFeedback(state.settings.celebrate);
              toast('Meting opgeslagen. Volgende week weer.', true);
            },
          }),
          el(
            'p',
            { class: 'faint center' },
            'Ochtend, nuchter, na het toilet, vóór eten en drinken.',
          ),
        ),
    });
  }

  function openWhySheet() {
    openSheet({
      title: 'Waarom één keer per week?',
      render: () =>
        el(
          'div',
          { class: 'stack' },
          el(
            'p',
            { class: 'muted' },
            'Je gewicht schommelt dagelijks met een kilo of meer door vocht, glycogeen en wat er nog in je darmen zit. Dat is ruis, geen voortgang.',
          ),
          el(
            'p',
            { class: 'muted' },
            'Wie dagelijks weegt, reageert op die ruis: eerst blij, dan gefrustreerd, en uiteindelijk stopt-ie. Eén meting per week onder dezelfde omstandigheden, en dan kijken naar het gemiddelde over 3-4 weken — dat is het signaal waar je iets aan hebt.',
          ),
          card(
            'flat',
            el('h3', {}, 'Zelfde omstandigheden'),
            el(
              'p',
              { class: 'muted' },
              'Ochtend, nuchter, na het toilet, vóór eten en drinken. Elke week hetzelfde.',
            ),
          ),
          button('Duidelijk', { variant: 'ghost block', onclick: closeSheet }),
        ),
    });
  }

  const fileInput = el('input', {
    type: 'file',
    accept: 'image/*',
    style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const key = `photo_${Date.now()}`;
      await savePhoto(key, file);
      update((s) => {
        s.photos = [...s.photos, { id: newId('ph'), day, blobKey: key }];
      });
      toast('Foto lokaal opgeslagen.');
    },
  });

  return el(
    'div',
    { class: 'screen' },

    el(
      'header',
      { class: 'screen-head' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow' }, 'Lichaam'),
        el('h1', {}, latest ? `${nl(latest.average)} kg` : 'Nog geen meting'),
        when(!!latest, () =>
          el('p', { class: 'faint' }, 'Voortschrijdend gemiddelde, niet je laatste getal.'),
        ),
      ),
      when(!!insight, () =>
        badge(
          `${insight.kgPerWeek > 0 ? '+' : ''}${insight.kgPerWeek.toFixed(2).replace('.', ',')} kg/wk`,
          insight.direction === 'stabiel' ? 'calm' : 'accent',
        ),
      ),
    ),

    /* De harde 1×-per-week-regel (§8.6) staat hier centraal. */
    card(
      gate.allowed ? null : 'flat',
      cardTitle(
        el('p', { class: 'eyebrow' }, 'Weegmoment'),
        badge(`${DAY_NAMES_LONG[state.profile.weighInDay - 1]}ochtend`, 'calm'),
      ),
      el('p', { class: 'muted' }, gate.reason),
      ...(gate.allowed
        ? [button('Meting invoeren', { variant: 'primary lg block', onclick: openWeighInSheet })]
        : [
            el(
              'div',
              { class: 'row-between' },
              el('span', { class: 'faint' }, 'Volgende meting'),
              el('span', { class: 'faint' }, `over ${plural(gate.daysUntilNext, 'dag', 'dagen')}`),
            ),
            button('Waarom maar één keer per week?', {
              variant: 'quiet block',
              onclick: openWhySheet,
            }),
          ]),
    ),

    when(points.length >= 2, () => trendChart(points)),

    when(!!insight?.tip, () =>
      card('calm', el('h3', {}, 'Kleine bijstelling'), el('p', { class: 'muted' }, insight.tip)),
    ),

    when(latest?.bodyFatPct !== undefined && latest?.bodyFatPct !== null, () =>
      card(
        null,
        cardTitle(
          el('p', { class: 'eyebrow' }, 'Vetpercentage'),
          badge(`${nl(latest.bodyFatPct)}%`, 'accent'),
        ),
        el('p', { class: 'muted' }, bodyFatNote(latest.bodyFatPct)),
        el(
          'p',
          { class: 'faint' },
          `Richtpunt voor zichtbare buikspieren: ${BODY_FAT_TARGET.min}-${BODY_FAT_TARGET.max}%.`,
        ),
      ),
    ),

    card(
      null,
      cardTitle(
        el('p', { class: 'eyebrow' }, "Voortgangsfoto's"),
        el('span', { class: 'faint' }, String(state.photos.length)),
      ),
      el(
        'p',
        { class: 'muted' },
        'Privé en alleen op dit apparaat. Ze worden nergens naartoe gestuurd.',
      ),
      when(state.photos.length > 0, () =>
        el(
          'div',
          { class: 'grid-3' },
          ...state.photos
            .slice()
            .reverse()
            .slice(0, 9)
            .map((p) =>
              photoThumb(p, async () => {
                await deletePhoto(p.blobKey);
                update((s) => {
                  s.photos = s.photos.filter((x) => x.id !== p.id);
                });
                toast('Foto verwijderd');
              }),
            ),
        ),
      ),
      fileInput,
      button('Foto toevoegen', {
        variant: 'ghost block',
        onclick: () => fileInput.click(),
      }),
    ),

    when(state.weighIns.length > 0, () =>
      card(
        null,
        el('p', { class: 'eyebrow' }, 'Alle metingen'),
        el(
          'div',
          { class: 'list' },
          ...[...state.weighIns]
            .sort((a, b) => b.day.localeCompare(a.day))
            .map((w) =>
              el(
                'div',
                { class: 'list-item' },
                el('span', { class: 'faint', style: { width: '62px' } }, formatDayShort(w.day)),
                el('span', { class: 'grow', style: { fontWeight: '600' } }, `${nl(w.weightKg)} kg`),
                when(w.bodyFatPct !== undefined && w.bodyFatPct !== null, () =>
                  el('span', { class: 'faint' }, `${nl(w.bodyFatPct)}%`),
                ),
                button('✕', {
                  variant: 'quiet sm',
                  ariaLabel: 'Meting verwijderen',
                  onclick: () =>
                    update((s) => {
                      s.weighIns = s.weighIns.filter((x) => x.id !== w.id);
                    }),
                }),
              ),
            ),
        ),
      ),
    ),
  );
}
